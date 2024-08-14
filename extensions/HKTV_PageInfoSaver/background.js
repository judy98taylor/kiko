// background.js 无DOM访问：服务工作线程没有DOM访问权限，它是在后台运行的。
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: {tabId: tab.id},
    files: ['content.js']
  });
});