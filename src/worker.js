/**
 * DOI Checker Cloudflare Worker
 * Main entry point for handling requests and scheduled events
 */

import logger from "./lib/logger.js";
import {
  ValidationError,
  NotFoundError,
  createErrorResponse,
  safeJsonParse,
} from "./lib/errors.js";
import { validateDOI } from "./lib/doi-validator.js";
import { checkMultipleDOIs, processResults } from "./lib/checker.js";
import { postBrokenDOIsToActivityPub } from "./lib/activitypub.js";
import { DOI_CONFIG } from "./config/constants.js";
import indexHtmlContent from '../public/index.html';

export default {
  /**
   * Handle HTTP requests
   */
  async fetch(request, env) {
    // Setup request-specific logging context
    const requestId = crypto.randomUUID();
    const requestLogger = logger.createScopedLogger(`request:${requestId}`);

    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Content-Type": "text/html" 
    };

    try {
      const url = new URL(request.url);
      requestLogger.info(`Handling ${request.method} ${url.pathname}`);

      // API endpoints
      if (url.pathname === "/add-doi" && request.method === "POST") {
        return await addDOI(request, env, requestLogger);
      }

      if (url.pathname === "/remove-doi" && request.method === "POST") {
        return await removeDOI(request, env, requestLogger);
      }

      if (url.pathname === "/check-now" && request.method === "POST") {
        return await checkAllDOIs(env, requestLogger);
      }

      if (url.pathname === "/status") {
        return await getStatus(env, requestLogger);
      }

      // Health check endpoint
      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Default response - API documentation
      return new Response(indexHtmlContent, {
        status: 200,
        headers: headers,
      });
    } catch (error) {
      requestLogger.error("Error handling request", {
        error: error.message,
        stack: error.stack,
      });
      return createErrorResponse(error);
    }
  },

  /**
   * Handle scheduled events
   */
  async scheduled(env) {
    const scheduledLogger = logger.createScopedLogger("scheduled");

    try {
      scheduledLogger.info("Starting scheduled DOI check");
      await checkAllDOIs(env, scheduledLogger);
      scheduledLogger.info("Completed scheduled DOI check");
    } catch (error) {
      scheduledLogger.error("Error in scheduled DOI check", {
        error: error.message,
        stack: error.stack,
      });
      // Rethrow so Cloudflare can handle the error
      throw error;
    }
  },
};

/**
 * Main checking function to check all DOIs
 * @param {Object} env - Environment variables and bindings
 * @param {Object} log - Logger instance
 * @returns {Promise<Response>} - API response
 */
async function checkAllDOIs(env, log) {
  try {
    // Get list of DOIs to check
    log.info("Getting DOI list");
    const doiListJson = await env.DOIS.get(DOI_CONFIG.DOI_LIST_KEY);
    if (!doiListJson) {
      log.info("No DOIs to check");
      return new Response("No DOIs configured", { status: 200 });
    }

    const doiList = safeJsonParse(doiListJson, "Invalid DOI list format");
    log.info(`Found ${doiList.length} DOIs to check`);

    // const results = [];
    // const newlyBroken = [];

    // // Get previous statuses for comparison
    const previousStatuses = {};
    for (const doi of doiList) {
      log.debug(`Checking DOI: ${doi}`);
      const statusJson = await env.STATUS.get(doi);
      if (statusJson) {
        try {
          previousStatuses[doi] = JSON.parse(statusJson);
        } catch (error) {
          log.warn(`Error parsing previous status for DOI ${doi}`, {
            error: error.message,
          });
          previousStatuses[doi] = null; // Fallback to null if parsing fails
        }
      } else {
        previousStatuses[doi] = null; // No previous status found
      }
    }

    //   try {
    //     const result = await checkSingleDOI(doi);
    //     results.push(result);

    //     // Compare with previous status
    //     const previousStatusJson = await env.STATUS.get(doi);
    //     let previousStatus = null;

    //     if (previousStatusJson) {
    //       try {
    //         previousStatus = JSON.parse(previousStatusJson);
    //       } catch (error) {
    //         log.warn(`Error parsing previous status for DOI ${doi}`, { error: error.message });
    //       }
    //     }

    //     // If it was working before but is broken now, it's newly broken
    //     if (previousStatus?.working && !result.working) {
    //       log.warn(`DOI has become broken: ${doi}`, {
    //         previousStatus: previousStatus?.httpStatus,
    //         currentStatus: result.httpStatus,
    //         error: result.error
    //       });
    //       newlyBroken.push(doi);
    //     }

    //     // Update status in KV
    //     const status = {
    //       lastCheck: new Date().toISOString(),
    //       working: result.working,
    //       httpStatus: result.httpStatus,
    //       error: result.error || null
    //     };

    //     await env.STATUS.put(doi, JSON.stringify(status));

    //   } catch (error) {
    //     log.error(`Error checking DOI ${doi}`, { error: error.message });

    //     // Continue with next DOI even if there's an error
    //     results.push({
    //       doi: doi,
    //       working: false,
    //       httpStatus: null,
    //       error: `Internal error: ${error.message}`
    //     });
    //   }
    // }

    // Check all DOIs
    const results = await checkMultipleDOIs(doiList);

    // Process results to find newly broken DOIs
    const processedResults = processResults(results, previousStatuses);
    const newlyBroken = processedResults.newlyBroken;

    // Update status in KV for each DOI
    for (const result of results) {
      // Retrieve existing status
      const existingStatusJson = await env.STATUS.get(result.doi);
      let existingStatus = {};
      if (existingStatusJson) {
        try {
          existingStatus = JSON.parse(existingStatusJson);
        } catch (error) {
          log.warn(`Error parsing existing status for DOI ${result.doi}`, {
            error: error.message,
          });
        }
      }

      // Initialize new timestamps if they don't exist
      const firstCheckedTimestamp = existingStatus.firstCheckedTimestamp || result.timestamp;
      let firstFailureTimestamp = existingStatus.firstFailureTimestamp;
      let firstSuccessTimestamp = existingStatus.firstSuccessTimestamp;

      if (!result.working && !firstFailureTimestamp) {
        firstFailureTimestamp = result.timestamp;
      }
      if (result.working && !firstSuccessTimestamp) {
        firstSuccessTimestamp = result.timestamp;
      }

      await env.STATUS.put(
        result.doi,
        JSON.stringify({
          // Preserve existing timestamps
          ...existingStatus,
          lastCheck: result.timestamp, // Use timestamp from check result
          working: result.working,
          httpStatus: result.httpStatus,
          error: result.error || null,
          firstCheckedTimestamp: firstCheckedTimestamp,
          firstFailureTimestamp: firstFailureTimestamp,
          firstSuccessTimestamp: firstSuccessTimestamp,
        })
      );
    }

    // Post to ActivityPub if there are newly broken DOIs
    if (newlyBroken.length > 0) {
      log.info(
        `Posting ${newlyBroken.length} newly broken DOIs to ActivityPub`
      );
      // Get ActivityPub configuration from environment
      const activityPubConfig = {
        enabled: env.ACTIVITYPUB_ENABLED !== "false",
        serverUrl: env.SNAC2_SERVER_URL,
        authToken: env.SNAC2_TOKEN,
      };

      try {
        await postBrokenDOIsToActivityPub(newlyBroken, activityPubConfig);
      } catch (error) {
        log.error("Error posting to ActivityPub", { error: error.message });
        // Continue execution even if ActivityPub posting fails
      }
    }

    log.info(
      `Checked ${doiList.length} DOIs, ${newlyBroken.length} newly broken`
    );
    return new Response(
      JSON.stringify({
        checked: doiList.length,
        newlyBroken: newlyBroken.length,
        results: results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    log.error("Error in checkAllDOIs", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Add a DOI to the monitoring list
 * @param {Request} request - The HTTP request
 * @param {Object} env - Environment variables and bindings
 * @returns {Promise<Response>} - API response
 */
export async function addDOI(request, env, log) {
  try {
    // Parse request body
    const body = await request.json().catch(() => {
      throw new ValidationError("Invalid JSON in request body");
    });

    const { doi, dois } = body; // Destructure both doi and dois

    let doisToAdd = [];
    if (doi) { // Handle single DOI for backward compatibility
      log.warn("Received single 'doi' field, which is deprecated. Use 'dois' array instead.");
      doisToAdd.push(doi);
    } else if (dois && Array.isArray(dois)) {
      doisToAdd = dois;
    } else {
      throw new ValidationError("Request body must contain a 'dois' array or a single 'doi' string.");
    }

    if (doisToAdd.length === 0) {
      return new Response(
        JSON.stringify({ message: "No DOIs provided to add." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    log.info(`Attempting to add ${doisToAdd.length} DOIs.`);

    // Get current list
    const doiListJson = await env.DOIS.get(DOI_CONFIG.DOI_LIST_KEY);
    const doiList = doiListJson
      ? safeJsonParse(doiListJson, "Invalid DOI list format")
      : [];

    const results = [];
    let addedCount = 0;
    let alreadyExistedCount = 0;
    let invalidCount = 0;

    for (const currentDoi of doisToAdd) {
      const validation = validateDOI(currentDoi);
      if (!validation.valid) {
        log.warn(`Invalid DOI format: ${currentDoi}. Error: ${validation.error}`);
        results.push({ doi: currentDoi, status: "invalid", error: validation.error });
        invalidCount++;
        continue;
      }

      const normalizedDoi = validation.normalized;
      if (!doiList.includes(normalizedDoi)) {
        doiList.push(normalizedDoi);
        results.push({ doi: currentDoi, normalized: normalizedDoi, status: "added" });
        addedCount++;
        log.info(`DOI added: ${currentDoi} (normalized: ${normalizedDoi})`);
      } else {
        results.push({ doi: currentDoi, normalized: normalizedDoi, status: "already_existed" });
        alreadyExistedCount++;
        log.info(`DOI already exists: ${currentDoi} (normalized: ${normalizedDoi})`);
      }
    }

    if (addedCount > 0) {
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
    }

    const message = `Processed ${doisToAdd.length} DOIs: ${addedCount} added, ${alreadyExistedCount} already existed, ${invalidCount} invalid.`;
    log.info(message);

    return new Response(
      JSON.stringify({
        message: message,
        results: results,
      }),
      {
        status: 200, // Or 207 for Multi-Status if some failed, but 200 is fine with detailed results
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    log.error("Error in addDOI", { error: error.message });
    return createErrorResponse(error);
  }
}

/**
 * Remove a DOI from the monitoring list
 * @param {Request} request - The HTTP request
 * @param {Object} env - Environment variables and bindings
 * @param {Object} log - Logger instance
 * @returns {Promise<Response>} - API response
 */
async function removeDOI(request, env, log) {
  try {
    // Parse request body
    const body = await request.json().catch(() => {
      throw new ValidationError("Invalid JSON in request body");
    });

    const { doi } = body;

    if (!doi) {
      throw new ValidationError("DOI is required");
    }

    log.info(`Removing DOI: ${doi}`);

    // Get current list
    const doiListJson = await env.DOIS.get(DOI_CONFIG.DOI_LIST_KEY);

    if (!doiListJson) {
      throw new NotFoundError("No DOIs configured");
    }

    const doiList = doiListJson ? JSON.parse(doiListJson) : [];

    // Check if DOI exists
    if (!doiList.includes(doi)) {
      throw new NotFoundError(`DOI ${doi} not found in monitoring list`);
    }

    // Remove DOI
    const updatedList = doiList.filter((d) => d !== doi);
    await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(updatedList));

    // Clean up status
    await env.STATUS.delete(doi);

    log.info(`DOI removed: ${doi}`);

    return new Response(
      JSON.stringify({
        message: `DOI ${doi} removed from monitoring list`,
        doi: doi,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    log.error("Error in removeDOI", { error: error.message });
    return createErrorResponse(error);
  }
}

/**
 * Get current status of all DOIs
 * @param {Object} env - Environment variables and bindings
 * @param {Object} log - Logger instance
 * @returns {Promise<Response>} - API response with status JSON
 */
async function getStatus(env, log) {
  try {
    log.info("Getting DOI status");
    const doiListJson = await env.DOIS.get(DOI_CONFIG.DOI_LIST_KEY);

    if (!doiListJson) {
      return new Response(JSON.stringify({ dois: [], count: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const doiList = safeJsonParse(doiListJson, "Invalid DOI list format");
    const statuses = [];

    for (const doi of doiList) {
      const statusJson = await env.STATUS.get(doi);
      let status;

      try {
        status = statusJson
          ? JSON.parse(statusJson)
          : {
              working: null,
              lastCheck: null,
              firstCheckedTimestamp: null,
              firstFailureTimestamp: null,
              firstSuccessTimestamp: null
            }; // Initialize with null for new fields if no status found
      } catch (error) {
        log.warn(`Error parsing status for DOI ${doi}`, {
          error: error.message,
        });
        status = {
          working: null,
          lastCheck: null,
          firstCheckedTimestamp: null,
          firstFailureTimestamp: null,
          firstSuccessTimestamp: null,
          error: "Status data corrupted",
        };
      }

      statuses.push({
        doi: doi,
        ...status, // Spread the entire status object which includes the new timestamps
      });
    }

    const response = {
      dois: statuses,
      count: doiList.length,
      working: statuses.filter((s) => s.working).length,
      broken: statuses.filter((s) => s.working === false).length,
      unchecked: statuses.filter((s) => s.working === null).length,
    };

    log.info(`Retrieved status for ${doiList.length} DOIs`);

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    log.error("Error in getStatus", { error: error.message });
    return createErrorResponse(error);
  }
}
