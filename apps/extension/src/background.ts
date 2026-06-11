// Ironlox Browser Extension — Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  // Extension installed successfully
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender.id || sender.id !== chrome.runtime.id) {
    return;
  }
  if (message.type === "AUTOFILL") {
    sendResponse({ success: true });
  }
  return true;
});

export {};
