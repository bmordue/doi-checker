/**
 * DOI Checker
 * Handles the logic for checking DOI links and determining their status
 */

/**
 * Check a single DOI and return its status
 * @param {string} doi - The DOI to check
 * @param {Object} options - Optional configuration for the check
 * @returns {Promise<Object>} - The check result with status information
 */
export async function checkSingleDOI(doi, options = {}) {
  const doiUrl = `https://doi.org/${doi}`;
  const userAgent = options.userAgent || 'DOI-Checker/1.0';
  
  try {
    const response = await fetch(doiUrl, {
      method: 'HEAD', // Use HEAD to avoid downloading full content
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent
      }
    });
    
    return {
      doi: doi,
      working: response.status >= 200 && response.status < 400,
      httpStatus: response.status,
      finalUrl: response.url
    };
    
  } catch (error) {
    return {
      doi: doi,
      working: false,
      httpStatus: null,
      error: error.message
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
  const results = [];
  
  for (const doi of doiList) {
    const result = await checkSingleDOI(doi, options);
    results.push(result);
  }
  
  return results;
}

/**
 * Process results and identify newly broken DOIs
 * @param {Object[]} results - The check results
 * @param {Object} previousStatuses - Previous status data for comparison
 * @returns {Object} - Processing results including newly broken DOIs
 */
export function processResults(results, previousStatuses) {
  const newlyBroken = [];
  
  for (const result of results) {
    const doi = result.doi;
    const previousStatus = previousStatuses[doi];
    
    // If it was working before but is broken now, it's newly broken
    if (previousStatus?.working && !result.working) {
      newlyBroken.push(doi);
    }
  }
  
  return {
    total: results.length,
    working: results.filter(r => r.working).length,
    broken: results.filter(r => !r.working).length,
    newlyBroken: newlyBroken
  };
}