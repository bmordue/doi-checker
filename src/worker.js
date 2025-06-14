/**
 * DOI Checker Cloudflare Worker
 * Main entry point for handling requests and scheduled events
 */

import { isValidDOI, validateDOI } from './lib/doi-validator.js';
import { checkSingleDOI, checkMultipleDOIs, processResults } from './lib/checker.js';
import { postBrokenDOIsToActivityPub } from './lib/activitypub.js';
import { DOI_CONFIG } from './config/constants.js';

export default {
  // Handle HTTP requests
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // API endpoints
    if (url.pathname === '/add-doi' && request.method === 'POST') {
      return await addDOI(request, env);
    }
    
    if (url.pathname === '/remove-doi' && request.method === 'POST') {
      return await removeDOI(request, env);
    }
    
    if (url.pathname === '/check-now' && request.method === 'POST') {
      return await checkAllDOIs(env);
    }
    
    if (url.pathname === '/status') {
      return await getStatus(env);
    }
    
    // Default response - API documentation
    return new Response('DOI Checker API\n/add-doi (POST)\n/remove-doi (POST)\n/check-now (POST)\n/status (GET)', {
      status: 200
    });
  },
  
  // Handle scheduled events
  async scheduled(event, env, ctx) {
    await checkAllDOIs(env);
  }
};

/**
 * Main checking function to check all DOIs
 * @param {Object} env - Environment variables and bindings
 * @returns {Promise<Response>} - API response
 */
async function checkAllDOIs(env) {
  try {
    // Get list of DOIs to check
    const doiListJson = await env.DOIS.get(DOI_CONFIG.DOI_LIST_KEY);
    if (!doiListJson) {
      console.log('No DOIs to check');
      return new Response('No DOIs configured', { status: 200 });
    }
    
    const doiList = JSON.parse(doiListJson);
    
    // Get previous statuses for comparison
    const previousStatuses = {};
    for (const doi of doiList) {
      const statusJson = await env.STATUS.get(doi);
      if (statusJson) {
        previousStatuses[doi] = JSON.parse(statusJson);
      }
    }
    
    // Check all DOIs
    const results = await checkMultipleDOIs(doiList);
    
    // Process results to find newly broken DOIs
    const processedResults = processResults(results, previousStatuses);
    const newlyBroken = processedResults.newlyBroken;
    
    // Update status in KV for each DOI
    for (const result of results) {
      await env.STATUS.put(result.doi, JSON.stringify({
        lastCheck: new Date().toISOString(),
        working: result.working,
        httpStatus: result.httpStatus,
        error: result.error || null
      }));
    }
    
    // Post to ActivityPub if there are newly broken DOIs
    if (newlyBroken.length > 0) {
      // Get ActivityPub configuration from environment
      const activityPubConfig = {
        enabled: env.ACTIVITYPUB_ENABLED !== 'false',
        serverUrl: env.SNAC2_SERVER_URL,
        authToken: env.SNAC2_TOKEN
      };
      
      try {
        await postBrokenDOIsToActivityPub(newlyBroken, activityPubConfig);
      } catch (error) {
        console.error('Error posting to ActivityPub:', error);
        // Continue execution even if ActivityPub posting fails
      }
    }
    
    console.log(`Checked ${doiList.length} DOIs, ${newlyBroken.length} newly broken`);
    return new Response(`Checked ${doiList.length} DOIs, ${newlyBroken.length} newly broken`, {
      status: 200
    });
    
  } catch (error) {
    console.error('Error in checkAllDOIs:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Add a DOI to the monitoring list
 * @param {Request} request - The HTTP request
 * @param {Object} env - Environment variables and bindings
 * @returns {Promise<Response>} - API response
 */
async function addDOI(request, env) {
  try {
    const { doi } = await request.json();
    
    // Validate DOI
    const validation = validateDOI(doi);
    if (!validation.valid) {
      return new Response(`Invalid DOI: ${validation.error}`, { status: 400 });
    }
    
    // Get current list
    const doiListJson = await env.DOIS.get(DOI_CONFIG.DOI_LIST_KEY);
    const doiList = doiListJson ? JSON.parse(doiListJson) : [];
    
    // Add if not already present
    if (!doiList.includes(validation.normalized)) {
      doiList.push(validation.normalized);
      await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(doiList));
    }
    
    return new Response(`DOI ${validation.normalized} added to monitoring list`, { status: 200 });
    
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Remove a DOI from the monitoring list
 * @param {Request} request - The HTTP request
 * @param {Object} env - Environment variables and bindings
 * @returns {Promise<Response>} - API response
 */
async function removeDOI(request, env) {
  try {
    const { doi } = await request.json();
    
    // Get current list
    const doiListJson = await env.DOIS.get(DOI_CONFIG.DOI_LIST_KEY);
    const doiList = doiListJson ? JSON.parse(doiListJson) : [];
    
    // Remove DOI
    const updatedList = doiList.filter(d => d !== doi);
    await env.DOIS.put(DOI_CONFIG.DOI_LIST_KEY, JSON.stringify(updatedList));
    
    // Clean up status
    await env.STATUS.delete(doi);
    
    return new Response(`DOI ${doi} removed from monitoring list`, { status: 200 });
    
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Get current status of all DOIs
 * @param {Object} env - Environment variables and bindings
 * @returns {Promise<Response>} - API response with status JSON
 */
async function getStatus(env) {
  try {
    const doiListJson = await env.DOIS.get(DOI_CONFIG.DOI_LIST_KEY);
    if (!doiListJson) {
      return new Response(JSON.stringify({ dois: [], count: 0 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const doiList = JSON.parse(doiListJson);
    const statuses = [];
    
    for (const doi of doiList) {
      const statusJson = await env.STATUS.get(doi);
      const status = statusJson ? JSON.parse(statusJson) : { working: null, lastCheck: null };
      statuses.push({
        doi: doi,
        ...status
      });
    }
    
    return new Response(JSON.stringify({
      dois: statuses,
      count: doiList.length,
      working: statuses.filter(s => s.working).length,
      broken: statuses.filter(s => s.working === false).length,
      unchecked: statuses.filter(s => s.working === null).length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}