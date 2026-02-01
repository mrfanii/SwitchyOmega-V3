function reportURLChange() {
  chrome.runtime.sendMessage({
    type: 'url-change',
    hasTransition: !document.referrer,
  });
}
window.addEventListener('popstate', reportURLChange);
reportURLChange();
