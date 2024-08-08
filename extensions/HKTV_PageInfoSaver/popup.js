document.addEventListener("DOMContentLoaded", function () {
  var saveButton = document.getElementById("save-button");
  var downloadButton = document.getElementById("download-button");

  var saveDisplay = document.getElementById("save-display");
  var downloadDisplay = document.getElementById("download-display");
  var isProcessing = false;

  var productCode

  saveButton.addEventListener("click", function () {
    if (isProcessing) {
      saveDisplay.textContent = "save操作正在进行中，请稍候...";
      console.log("save操作正在进行中，请稍候...");
      return;
    }

    isProcessing = true;
    saveButton.disabled = true; // 禁用按钮

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (chrome.runtime.lastError) {
        console.error("查询标签页时出错：", chrome.runtime.lastError.message);
        saveDisplay.textContent = "获取页面信息时出错，请重试。";
        resetProcessingState();
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          func: getPageInfo,
        },
        (injectionResults) => {
          if (chrome.runtime.lastError) {
            console.error("执行脚本时出错：", chrome.runtime.lastError.message);
            saveDisplay.textContent = "获取页面信息时出错，请重试。";
            resetProcessingState();
            return;
          }

          if (injectionResults && injectionResults[0]) {
            let obj_injectionResults = injectionResults[0].result;
            let obj_extractInfoFromUrl = extractInfoFromUrl(tabs[0].url);

            let infoObject = {
              pageTitle: tabs[0].title,
              productName: obj_injectionResults.productName,
              productBrand: obj_injectionResults.productBrand,
              shortDesc: obj_injectionResults.shortDesc,
              origin: obj_injectionResults.origin,
              categoryPath: obj_extractInfoFromUrl.categoryPath,
              productShopId: obj_extractInfoFromUrl.productShopId,
              productSKU: obj_extractInfoFromUrl.productSKU,
              url: decodeURIComponent(tabs[0].url),
              imgsUrls: obj_injectionResults.imgsUrls,
            };

            let content = generateContent(infoObject);
            saveDisplay.textContent = content;

            // 保存信息到本地文件
            savePageInfoToFile(content);
          } else {
            console.error("未能获取页面信息");
            saveDisplay.textContent = "未能获取页面信息，请重试。";
          }

          resetProcessingState();
        }
      );
    });
  });

  downloadButton.addEventListener("click", function () {
    if (isProcessing) {
      downloadDisplay.textContent = "download操作正在进行中，请稍候...";
      console.log("download操作正在进行中，请稍候...");
      return;
    }

    isProcessing = true;
    downloadButton.disabled = true; // 禁用按钮

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (chrome.runtime.lastError) {
        console.error("查询标签页时出错：", chrome.runtime.lastError.message);
        saveDisplay.textContent = "获取页面信息时出错，请重试。";
        resetProcessingState();
        return;
      }
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          func: getProductImagesUrls,
        },
        (injectionResults) => {
          if (chrome.runtime.lastError) {
            console.error("执行脚本时出错：", chrome.runtime.lastError.message);
            saveDisplay.textContent = "获取页面信息时出错，请重试。";
            resetProcessingState();
            return;
          }

          if (injectionResults && injectionResults[0]) {
            let imageUrls = injectionResults[0].result;
            // console.log(imageUrls);
            downloadImagesToLocal(imageUrls);
            downloadDisplay.textContent = "产品图片下载成功";
          } else {
            console.error("未能下载产品图片");
            downloadDisplay.textContent = "未能下载产品图片，请重试。";
          }

          resetProcessingState();
        }
      );
    });
  });

  // 在内容脚本中执行的函数
  function getPageInfo() {
    const productNameElement = document.querySelector(".breadcrumb-btm");
    const productName = productNameElement ? productNameElement.innerText : "";
    const productBrand = productName.split(" - ")[0] ?? "";

    const shortDescElement = document.querySelector(".short-desc");
    const shortDesc = shortDescElement ? shortDescElement.innerText : "";

    const originElement = document.querySelector(
      ".productPackingSpec td:nth-child(2) span"
    );
    const origin = originElement ? originElement.innerText : "";

    // TODO: 作用域！！！有待优化！
    function _getProductImagesUrls() {
      const gallery = document.querySelector(".productImageGallery");
      if (!gallery) return [];

      const images = gallery.querySelectorAll("img[data-primaryimagesrc]");
      return Array.from(images).map(
        (img) => "https:" + img.getAttribute("data-primaryimagesrc")
      );
    }
    const imgsUrls = _getProductImagesUrls().join("\n");

    return { productBrand, productName, shortDesc, origin, imgsUrls };
  }

  function generateContent(infoObject) {
    return Object.entries(infoObject)
      .map(([key, value]) => `${key}:\n${value}`)
      .join("\n\n");
  }

  function extractInfoFromUrl(url) {
    // 使用 '/p/' 拆分 URL 并获取最后一个部分作为 productCode
    const p_parts = url.split("/p/");

    productCode = p_parts[p_parts.length - 1];
    const productShopId = productCode.split("_")[0];
    const productSKU =
      productCode.split("_")[productCode.split("_").length - 1];

    // 使用 '/s/' 拆分 '/p/'前的 URL
    const s_parts = p_parts[0].split("/s/");

    // 提取类别路径
    let categoryPath = s_parts[s_parts.length - 1];

    // 去掉第一个和最后一个 替换 %26 为 & 并将 - 替换为空格
    categoryPath = categoryPath
      .split("/")
      .slice(1, -1)
      .join(" / ")
      .replace(/%26/g, "&")
      .replace(/-/g, " ");

    // 解码 URL 编码的字符
    categoryPath = decodeURIComponent(categoryPath);

    return { categoryPath, productShopId, productSKU };
  }
  // Helper function to save a page title to local file
  function savePageInfoToFile(content) {
    // 使用 \n 来创建换行
    let formattedContent = content.replace(/\n/g, "\r\n");
    // const dateString = getCurrentDateString();
    const lang = checkStringType(content);

    chrome.downloads.download({
      filename: `${productCode}_${lang}.txt`,
      saveAs: true,
      conflictAction: "overwrite",
      url:
        "data:text/plain;charset=utf-8," + encodeURIComponent(formattedContent),
    });
  }

  function getCurrentDateString() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  function checkStringType(str) {
    // 检查是否包含中文字符
    const hasChineseChar = /[\u4e00-\u9fa5]/.test(str);
    if (hasChineseChar) {
      return 'Chinese';
    }
  
    // 检查是否全部由英文字符组成
    const isEnglish = /^[a-zA-Z]+$/.test(str);
    if (isEnglish) {
      return 'English';
    }
  
    // 如果既不是中文也不是英文,返回 'Other'
    return 'Other';
  }

  function getProductImagesUrls() {
    const gallery = document.querySelector(".productImageGallery");
    if (!gallery) return [];

    const images = gallery.querySelectorAll("img[data-primaryimagesrc]");
    return Array.from(images).map(
      (img) => "https://" + img.getAttribute("data-primaryimagesrc").split('//')[1]
    );
  }
  function downloadImagesToLocal(imageUrls) {
    console.log(imageUrls)

    imageUrls.forEach((url, index) => {
      chrome.downloads.download(
        {
          url: url,
          filename: `product_image_${index + 1}.jpg`,
          saveAs: true,
          conflictAction: "uniquify",
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error(
              `下载图片 ${url} 时出错:`,
              chrome.runtime.lastError.message
            );
          } else {
            console.log(`图片 ${url} 下载成功，下载ID: ${downloadId}`);
          }
        }
      );
    });
  }

  function resetProcessingState() {
    isProcessing = false;
    saveButton.disabled = false; // 重新启用按钮
    downloadButton.disabled = false; // 重新启用按钮
  }
});
