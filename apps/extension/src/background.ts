// Ironlox Browser Extension — Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  // Extension installed successfully
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
