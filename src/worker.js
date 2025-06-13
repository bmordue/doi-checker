// DOI Checker Cloudflare Worker
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Simple API endpoints
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
    
    return new Response('DOI Checker API\n/add-doi (POST)\n/remove-doi (POST)\n/check-now (POST)\n/status (GET)', {
      status: 200
    });
  },
  
  // Cron trigger for scheduled checks
  async scheduled(event, env, ctx) {
    await checkAllDOIs(env);
  }
};

// Main checking function
async function checkAllDOIs(env) {
  try {
    // Get list of DOIs to check
    const doiListJson = await env.DOIS.get('doi-list');
    if (!doiListJson) {
      console.log('No DOIs to check');
      return new Response('No DOIs configured', { status: 200 });
    }
    
    const doiList = JSON.parse(doiListJson);
    const results = [];
    const newlyBroken = [];
    
    // Check each DOI
    for (const doi of doiList) {
      const result = await checkSingleDOI(doi);
      results.push(result);
      
      // Compare with previous status
      const previousStatusJson = await env.STATUS.get(doi);
      const previousStatus = previousStatusJson ? JSON.parse(previousStatusJson) : null;
      
      // If it was working before but is broken now, it's newly broken
      if (previousStatus?.working && !result.working) {
        newlyBroken.push(doi);
      }
      
      // Update status in KV
      await env.STATUS.put(doi, JSON.stringify({
        lastCheck: new Date().toISOString(),
        working: result.working,
        httpStatus: result.httpStatus,
        error: result.error || null
      }));
    }
    
    // Post to ActivityPub if there are newly broken DOIs
    if (newlyBroken.length > 0) {
      await postToActivityPub(newlyBroken, env);
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

// Check a single DOI
async function checkSingleDOI(doi) {
  const doiUrl = `https://doi.org/${doi}`;
  
  try {
    const response = await fetch(doiUrl, {
      method: 'HEAD', // Use HEAD to avoid downloading full content
      redirect: 'follow',
      headers: {
        'User-Agent': 'DOI-Checker/1.0'
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

// Add a DOI to the monitoring list
async function addDOI(request, env) {
  try {
    const { doi } = await request.json();
    
    if (!doi || !isValidDOI(doi)) {
      return new Response('Invalid DOI format', { status: 400 });
    }
    
    // Get current list
    const doiListJson = await env.DOIS.get('doi-list');
    const doiList = doiListJson ? JSON.parse(doiListJson) : [];
    
    // Add if not already present
    if (!doiList.includes(doi)) {
      doiList.push(doi);
      await env.DOIS.put('doi-list', JSON.stringify(doiList));
    }
    
    return new Response(`DOI ${doi} added to monitoring list`, { status: 200 });
    
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

// Remove a DOI from the monitoring list
async function removeDOI(request, env) {
  try {
    const { doi } = await request.json();
    
    // Get current list
    const doiListJson = await env.DOIS.get('doi-list');
    const doiList = doiListJson ? JSON.parse(doiListJson) : [];
    
    // Remove DOI
    const updatedList = doiList.filter(d => d !== doi);
    await env.DOIS.put('doi-list', JSON.stringify(updatedList));
    
    // Clean up status
    await env.STATUS.delete(doi);
    
    return new Response(`DOI ${doi} removed from monitoring list`, { status: 200 });
    
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

// Get current status of all DOIs
async function getStatus(env) {
  try {
    const doiListJson = await env.DOIS.get('doi-list');
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

// Basic DOI validation
function isValidDOI(doi) {
  // Simple DOI pattern: 10.xxxx/yyyy
  return /^10\.\d{4,}\/\S+$/.test(doi);
}

// Post broken DOIs to ActivityPub (placeholder)
async function postToActivityPub(brokenDOIs, env) {
  // TODO: Implement ActivityPub posting to your snac2 server
  const message = `🔗 DOI Link Check Alert: ${brokenDOIs.length} broken DOI(s) found:\n${brokenDOIs.map(doi => `• https://doi.org/${doi}`).join('\n')}`;
  
  console.log('Would post to ActivityPub:', message);
  
  // Placeholder for actual implementation
  // You'll need to configure your snac2 server details in environment variables
  // const response = await fetch('https://your-snac2-server.com/api/note', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': 'Bearer ' + env.SNAC2_TOKEN
  //   },
  //   body: JSON.stringify({
  //     content: message
  //   })
  // });
}