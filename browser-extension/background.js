// background.js
console.log("Background service worker loaded.");

// Example: Listener for messages from the popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Message received in background:", request);
  if (request.greeting === "hello from popup") {
    sendResponse({ farewell: "goodbye from background" });
  }
  // Return true to indicate you wish to send a response asynchronously
  // (e.g. if you need to fetch data before responding)
  return true;
});

// Example: Listener for when the extension is installed or updated
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === "install") {
    console.log("Extension installed.");
    // Perform initial setup tasks here
  } else if (details.reason === "update") {
    const thisVersion = chrome.runtime.getManifest().version;
    console.log("Extension updated from " + details.previousVersion + " to " + thisVersion + "!");
    // Perform migration tasks here if needed
  }
});

// Example: Setting up a context menu item
// chrome.contextMenus.create({
//   id: "myContextMenu",
//   title: "My Context Menu Item",
//   contexts: ["selection"] // Only show when text is selected
// });

// chrome.contextMenus.onClicked.addListener(function(info, tab) {
//   if (info.menuItemId === "myContextMenu") {
//     console.log("Context menu item clicked. Selected text:", info.selectionText);
//     // You can then do something with the selected text, e.g., send it to your API
//   }
// });
