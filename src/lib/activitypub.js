/**
 * ActivityPub Integration
 * Handles posting updates to an ActivityPub server (snac2)
 */

import logger from './logger.js';
import { ExternalServiceError } from './errors.js';

// Initialize module logger
const log = logger.createScopedLogger('activitypub');

// Default configuration
const DEFAULT_CONFIG = {
  enabled: true,
  contentType: 'application/json',
  timeout: 10000, // 10 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  maxPostLength: 500,
};

/**
 * Wait for a specified time
 * @param {number} ms - Time to wait in milliseconds
 * @returns {Promise<void>}
 */
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a message about broken DOIs for ActivityPub
 * @param {string[]} brokenDOIs - Array of broken DOI strings
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted message text
 */
export function formatActivityPubMessage(brokenDOIs, options = {}) {
  if (!brokenDOIs || !Array.isArray(brokenDOIs) || brokenDOIs.length === 0) {
    log.warn('No broken DOIs provided for message formatting');
    return '';
  }

  const emoji = options.emoji || '=';
  const doiBaseUrl = options.doiBaseUrl || 'https://doi.org/';

  let message = `${emoji} DOI Link Check Alert: ${brokenDOIs.length} broken DOI(s) found:\n`;
  message += brokenDOIs.map((doi) => `" ${doiBaseUrl}${doi}`).join('\n');

  // Add timestamp if requested
  if (options.includeTimestamp) {
    message += `\n\nChecked at: ${new Date().toISOString()}`;
  }

  // Add signature if provided
  if (options.signature) {
    message += `\n\n${options.signature}`;
  }

  // Truncate if message is too long
  const maxLength = options.maxLength || DEFAULT_CONFIG.maxPostLength;
  if (message.length > maxLength) {
    const truncatedMessage = message.substring(0, maxLength - 3) + '...';
    log.warn(`Message truncated from ${message.length} to ${truncatedMessage.length} characters`);
    return truncatedMessage;
  }

  return message;
}

/**
 * Post a message to the ActivityPub server
 * @param {string} message - The message to post
 * @param {Object} config - Configuration including server URL and auth token
 * @returns {Promise<Object>} - Server response
 * @throws {ExternalServiceError} - If the ActivityPub server request fails
 */
export async function postToActivityPub(message, config) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  if (!fullConfig.enabled) {
    log.info('ActivityPub posting disabled');
    return null;
  }

  if (!fullConfig.serverUrl) {
    const error = 'ActivityPub server URL is required';
    log.error(error);
    throw new ExternalServiceError(error);
  }

  if (!fullConfig.authToken) {
    const error = 'ActivityPub auth token is required';
    log.error(error);
    throw new ExternalServiceError(error);
  }

  if (!message) {
    const error = 'Message content is required';
    log.error(error);
    throw new ExternalServiceError(error);
  }

  log.info('Posting to ActivityPub', {
    serverUrl: fullConfig.serverUrl,
    messageLength: message.length,
  });

  // Initialize retry counter
  let retries = 0;
  let lastError = null;

  while (retries <= fullConfig.maxRetries) {
    try {
      if (retries > 0) {
        log.debug(`Retry ${retries}/${fullConfig.maxRetries} for ActivityPub post`);
        await sleep(fullConfig.retryDelay);
      }

      const response = await fetch(fullConfig.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': fullConfig.contentType,
          Authorization: `Bearer ${fullConfig.authToken}`,
        },
        body: JSON.stringify({
          content: message,
        }),
        cf: {
          timeout: fullConfig.timeout,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new ExternalServiceError(
          `ActivityPub server responded with ${response.status}: ${errorText}`,
          { status: response.status }
        );
      }

      const responseData = await response.json().catch(() => ({}));
      log.info('Successfully posted to ActivityPub', {
        statusCode: response.status,
        responseId: responseData.id,
      });

      return responseData;
    } catch (error) {
      lastError = error;
      retries++;
      log.warn(`Error posting to ActivityPub (attempt ${retries})`, {
        error: error.message,
      });
    }
  }

  // If we've exhausted all retries
  const errorMessage = `Failed to post to ActivityPub after ${fullConfig.maxRetries} retries`;
  log.error(errorMessage, {
    error: lastError?.message,
  });

  throw new ExternalServiceError(errorMessage, { cause: lastError });
}

/**
 * Convenience function to post broken DOIs to ActivityPub
 * @param {string[]} brokenDOIs - Array of broken DOI strings
 * @param {Object} config - Configuration including server URL and auth token
 * @returns {Promise<Object>} - Server response or null if disabled
 */
export async function postBrokenDOIsToActivityPub(brokenDOIs, config = {}) {
  if (!brokenDOIs || brokenDOIs.length === 0) {
    log.info('No broken DOIs to post');
    return null;
  }

  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Check if ActivityPub posting is enabled
  if (!fullConfig.enabled) {
    log.info('ActivityPub posting disabled');
    log.info('Would post to ActivityPub', {
      brokenDOIs: brokenDOIs,
      count: brokenDOIs.length,
    });
    return null;
  }

  try {
    const message = formatActivityPubMessage(brokenDOIs, fullConfig);
    return await postToActivityPub(message, fullConfig);
  } catch (error) {
    log.error('Error posting broken DOIs to ActivityPub', {
      error: error.message,
      doiCount: brokenDOIs.length,
    });
    throw error;
  }
}

export default {
  formatActivityPubMessage,
  postToActivityPub,
  postBrokenDOIsToActivityPub,
};
