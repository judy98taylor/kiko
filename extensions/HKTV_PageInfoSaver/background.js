chrome.action.onClicked.addListener(function(tab) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      var pageTitle = tabs[0].title;
      savePageTitleToFile(pageTitle);
    });
  });
  
  function savePageTitleToFile(title) {
    chrome.downloads.download({
      filename: 'qqq.txt',
      saveAs: true,
      conflictAction: 'overwrite',
      url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(title)
    });
  }