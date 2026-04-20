import { dbg } from '../utils/debug';

// MV3 service worker — features run entirely in content scripts.
chrome.runtime.onInstalled.addListener(() => {
  dbg('[Kroger Enhancer] Extension installed.');
});
