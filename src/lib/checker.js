/**
 * DOI Checker
 * Handles the logic for checking DOI links and determining their status
 */

import logger from './logger.js';
import { ExternalServiceError } from './errors.js';
import { parseDOI } from './doi-validator.js';

// Initialize module logger
const log = logger.createScopedLogger('checker');

// Default settings for DOI checking
const DEFAULT_CHECK_OPTIONS = {
  userAgent: 'DOI-Checker/1.0',
  timeout: 10000, // 10 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  followRedirects: true
};

/**
 * Wait for a specified time
 * @param {number} ms - Time to wait in milliseconds
 * @returns {Promise<void>}
 */
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check a single DOI and return its status
 * @param {string} doi - The DOI to check
 * @param {Object} options - Optional configuration for the check
 * @returns {Promise<Object>} - The check result with status information
 */
export async function checkSingleDOI(doi, options = {}) {
  const checkOptions = { ...DEFAULT_CHECK_OPTIONS, ...options };
  
  try {
    // Parse the DOI to validate and get the URL
    const parsedDOI = parseDOI(doi);
    const doiUrl = parsedDOI.url;
    
    log.info(`Checking DOI: ${doi}`, { url: doiUrl });
    
    // Initialize retry counter
    let retries = 0;
    let lastError = null;
    
    while (retries <= checkOptions.maxRetries) {
      try {
        if (retries > 0) {
          log.debug(`Retry ${retries}/${checkOptions.maxRetries} for DOI: ${doi}`);
          await sleep(checkOptions.retryDelay);
        }
        
        const response = await fetch(doiUrl, {
          method: 'HEAD', // Use HEAD to avoid downloading full content
          redirect: checkOptions.followRedirects ? 'follow' : 'manual',
          headers: {
            'User-Agent': checkOptions.userAgent
          },
          cf: {
            timeout: checkOptions.timeout
          }
        });

        const finalResponse = await fetch(response.url, {
          method: 'HEAD', // Ensure we get the final URL after redirects
          redirect: checkOptions.followRedirects ? 'follow' : 'manual',
          headers: {
            'User-Agent': checkOptions.userAgent
          },
          cf: {
            timeout: checkOptions.timeout
          }
        });
        
        const result = {
          doi: doi,
          working: finalResponse.status >= 200 && finalResponse.status < 400,
          httpStatus: finalResponse.status,
          finalUrl: response.url,
          timestamp: new Date().toISOString()
        };
        
        log.debug(`DOI check result: ${doi}`, { 
          status: response.status, 
          working: result.working 
        });
        
        return result;
      } catch (error) {
        lastError = error;
        retries++;
        log.warn(`Error checking DOI ${doi} (attempt ${retries})`, { 
          error: error.message 
        });
      }
    }
    
    // If we've exhausted all retries
    log.error(`Failed to check DOI after ${checkOptions.maxRetries} retries: ${doi}`, {
      error: lastError?.message
    });
    
    return {
      doi: doi,
      working: false,
      httpStatus: null,
      error: lastError?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    log.error(`Error processing DOI check: ${doi}`, { error: error.message });
    
    return {
      doi: doi,
      working: false,
      httpStatus: null,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Check all DOIs in a list and return their statuses
 * @param {string[]} doiList - Array of DOIs to check
 * @param {Object} options - Optional configuration for the checks
 * @returns {Promise<Object[]>} - Array of check results
 */
export async function checkMultipleDOIs(doiList, options = {}) {
  if (!doiList || !Array.isArray(doiList)) {
    log.warn('Invalid DOI list provided', { doiList });
    return [];
  }
  
  log.info(`Checking ${doiList.length} DOIs`);
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  
  for (const doi of doiList) {
    try {
      const result = await checkSingleDOI(doi, options);
      results.push(result);
      
      if (result.working) {
        successCount++;
      } else {
        failureCount++;
      }
    } catch (error) {
      log.error(`Unexpected error checking DOI ${doi}`, { error: error.message });
      
      results.push({
        doi: doi,
        working: false,
        httpStatus: null,
        error: `Internal error: ${error.message}`,
        timestamp: new Date().toISOString()
      });
      
      failureCount++;
    }
  }
  
  log.info(`Completed checking ${doiList.length} DOIs`, { 
    total: doiList.length,
    success: successCount,
    failure: failureCount
  });
  
  return results;
}

/**
 * Process results and identify newly broken DOIs
 * @param {Object[]} results - The check results
 * @param {Object} previousStatuses - Previous status data for comparison
 * @returns {Object} - Processing results including newly broken DOIs
 */
export function processResults(results, previousStatuses = {}) {
  if (!results || !Array.isArray(results)) {
    log.warn('Invalid results array', { results });
    return {
      total: 0,
      working: 0,
      broken: 0,
      newlyBroken: []
    };
  }
  
  const newlyBroken = [];
  
  for (const result of results) {
    const doi = result.doi;
    const previousStatus = previousStatuses[doi];
    
    // If it was working before but is broken now, it's newly broken
    if (previousStatus?.working && !result.working) {
      log.warn(`DOI has become broken: ${doi}`, { 
        previousStatus: previousStatus?.httpStatus,
        currentStatus: result.httpStatus,
        error: result.error
      });
      newlyBroken.push(doi);
    }
  }
  
  const processedResults = {
    total: results.length,
    working: results.filter(r => r.working).length,
    broken: results.filter(r => !r.working).length,
    newlyBroken: newlyBroken
  };
  
  log.info('Processed results', processedResults);
  
  return processedResults;
}

/**
 * Check a DOI and generate a comprehensive status report
 * @param {string} doi - The DOI to check
 * @param {Object} options - Check options
 * @returns {Promise<Object>} - Detailed status report
 */
export async function generateDOIReport(doi, options = {}) {
  try {
    // Parse the DOI to validate and get the URL
    const parsedDOI = parseDOI(doi);
    const doiUrl = parsedDOI.url;
    
    log.info(`Generating report for DOI: ${doi}`, { url: doiUrl });
    
    // First do a HEAD request to check status
    const headResult = await checkSingleDOI(doi, options);
    
    // If the DOI is working, try to get more information with a GET request
    let metadata = null;
    if (headResult.working) {
      try {
        const response = await fetch(doiUrl, {
          method: 'GET',
          headers: {
            'User-Agent': options.userAgent || DEFAULT_CHECK_OPTIONS.userAgent,
            'Accept': 'application/json, text/plain, */*'
          },
          cf: {
            timeout: options.timeout || DEFAULT_CHECK_OPTIONS.timeout
          }
        });
        
        // Try to extract some metadata from the response
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('json')) {
          const jsonData = await response.json();
          metadata = {
            title: jsonData.title,
            publisher: jsonData.publisher,
            type: jsonData.type,
            contentType
          };
        } else {
          metadata = {
            contentType,
            finalUrl: response.url
          };
        }
      } catch (error) {
        log.warn(`Error fetching metadata for DOI ${doi}`, { error: error.message });
        metadata = { error: error.message };
      }
    }
    
    return {
      ...headResult,
      metadata,
      parsedDOI
    };
  } catch (error) {
    log.error(`Error generating report for DOI ${doi}`, { error: error.message });
    
    return {
      doi: doi,
      working: false,
      httpStatus: null,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

export default {
  checkSingleDOI,
  checkMultipleDOIs,
  processResults,
  generateDOIReport
};
