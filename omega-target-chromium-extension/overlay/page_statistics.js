async function pageStatistics() {
  const userId = await getUserIdFromStore();

  async function getUserIdFromStore() {
    const result = await chrome.storage.sync.get(['user_id']);
    let uuid = result['user_id'];
    if (uuid) {
      return uuid;
    }
    uuid = makeUUID();
    await chrome.storage.sync.set({ user_id: uuid });
    return uuid;
  }

  function makeUUID() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (t, e) {
      return ('x' === t ? (16 * Math.random()) | 0 : (3 & e) | 8).toString(16);
    });
  }

  async function reportAction(url, referer) {
    await fetch('https://analytics.editcookie.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      },
      body: JSON.stringify({ name: 'SO', url: url, referrer: referer, timestamp: Date.now(), user_id: userId }),
    });
  }

  function isValidPage(url) {
    if (url == null) {
      return false;
    }
    return url.startsWith('http');
  }

  function tabInfo(id) {
    if (!(id in tabs)) {
      tabs[id] = { hasTransition: true };
    }
    return tabs[id];
  }

  let tabs = {};
  let lastId;
  let openers = {};
  let lastReport = '';

  chrome.tabs.onUpdated.addListener((tabId, changes, { url, openerTabId }) => {
    if (changes.status === 'complete') {
      const info = tabInfo(tabId);
      let referrer = info.url;
      let opener = openers[tabId];
      if (info.hasTransition) {
        if (openerTabId && opener === openerTabId) {
          const openerInfo = tabInfo(opener);
          if (openerInfo.url) referrer = openerInfo.url;
        } else {
          referrer = undefined;
        }
      } else if (!referrer || url === referrer) {
        const openerInfo = tabInfo(opener);
        if (openerInfo.url) referrer = openerInfo.url;
      }
      if (referrer && !isValidPage(referrer)) {
        referrer = undefined;
      }
      if (isValidPage(url) && url !== referrer && lastReport !== url + tabId) {
        reportAction(url, referrer);
        lastReport = url + tabId;
      }
      tabs[tabId] = { url };
    }
  });

  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== chrome.windows.WINDOW_ID_NONE) {
      chrome.windows.get(windowId, { populate: true }, (win) => {
        if (chrome.runtime.lastError) return;
        const tab = win.tabs.find((t) => t.active);
        if (tab) {
          lastId = tab.id;
          if (isValidPage(tab.url)) {
            tabInfo(tab.id).url = tab.url;
          }
        }
      });
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabs[tabId];
  });

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    lastId = tabId;
    chrome.tabs.get(tabId, function (tab) {
      if (isValidPage(tab.url)) {
        tabInfo(tabId).url = tab.url;
      }
    });
  });

  chrome.tabs.onCreated.addListener((tabInfo) => {
    if (tabInfo.pendingUrl !== 'chrome://newtab/') openers[tabInfo.id] = lastId;
  });

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'url-change' && sender?.tab?.id && message?.hasTransition) {
      const info = tabInfo(sender.tab.id);
      info.hasTransition = message.hasTransition;
    }
  });
}

(async () => {
  await pageStatistics();
})();
