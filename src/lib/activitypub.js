/**
 * ActivityPub Integration
 * Handles posting updates to an ActivityPub server (snac2)
 */

/**
 * Format a message about broken DOIs for ActivityPub
 * @param {string[]} brokenDOIs - Array of broken DOI strings
 * @returns {string} - Formatted message text
 */
export function formatActivityPubMessage(brokenDOIs) {
  return `= DOI Link Check Alert: ${brokenDOIs.length} broken DOI(s) found:\n${brokenDOIs.map(doi => `" https://doi.org/${doi}`).join('\n')}`;
}

/**
 * Post a message to the ActivityPub server
 * @param {string} message - The message to post
 * @param {Object} config - Configuration including server URL and auth token
 * @returns {Promise<Object>} - Server response
 */
export async function postToActivityPub(message, config) {
  if (!config?.serverUrl || !config?.authToken) {
    throw new Error('ActivityPub server URL and auth token are required');
  }
  
  try {
    const response = await fetch(config.serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.authToken}`
      },
      body: JSON.stringify({
        content: message
      })
    });
    
    if (!response.ok) {
      throw new Error(`ActivityPub server responded with ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error posting to ActivityPub:', error);
    throw error;
  }
}

/**
 * Convenience function to post broken DOIs to ActivityPub
 * @param {string[]} brokenDOIs - Array of broken DOI strings
 * @param {Object} config - Configuration including server URL and auth token
 * @returns {Promise<Object>} - Server response or null if disabled
 */
export async function postBrokenDOIsToActivityPub(brokenDOIs, config) {
  if (!brokenDOIs || brokenDOIs.length === 0) {
    return null; // Nothing to post
  }
  
  // Check if ActivityPub posting is enabled
  if (config?.enabled === false) {
    console.log('ActivityPub posting disabled');
    console.log('Would post to ActivityPub:', formatActivityPubMessage(brokenDOIs));
    return null;
  }
  
  const message = formatActivityPubMessage(brokenDOIs);
  return await postToActivityPub(message, config);
}