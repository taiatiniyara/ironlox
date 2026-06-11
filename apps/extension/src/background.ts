// Ironlox Browser Extension — Background Service Worker
// Handles autofill requests and sync

chrome.runtime.onInstalled.addListener(() => {
  console.log("Ironlox extension installed");
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "AUTOFILL") {
    // The autofill logic will be handled by the content script
    sendResponse({ success: true });
  }
  return true;
});

export {};
