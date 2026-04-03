// MV3 service worker — features run entirely in content scripts.
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Kroger Enhancer] Extension installed.');
});
