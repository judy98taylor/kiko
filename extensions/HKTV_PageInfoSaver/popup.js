document.addEventListener("DOMContentLoaded", function () {
  var saveButton = document.getElementById("save-button");
  var saveDisplay = document.getElementById("save-display");
  var isProcessing = false;
  var productCode;

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (chrome.runtime.lastError) {
      console.error("查询标签页时出错：", chrome.runtime.lastError.message);
      saveDisplay.textContent = "获取页面信息时出错，请重试。";
      resetProcessingState();
      return;
    }
    const url = tabs[0].url.split('?')[0];
    const lang = isEnglishPage(url) ? "en" : "zh";

    saveButton.addEventListener("click", function () {
      if (isProcessing) {
        saveDisplay.textContent = "save操作正在进行中，请稍候...";
        console.log("save操作正在进行中，请稍候...");
        return;
      }

      isProcessing = true;
      saveButton.disabled = true; // 禁用按钮

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
            let obj_extractInfoFromUrl = extractInfoFromUrl(url);

            let infoObject = {
              productName: obj_injectionResults.productName,
              productBrand: obj_injectionResults.productBrand,
              shortDesc: obj_injectionResults.shortDesc,
              origin: obj_injectionResults.origin,
              categoryPath: obj_extractInfoFromUrl.categoryPath,
            };

            let content = generateContent(infoObject);
            saveDisplay.textContent = content;

            // 显示图片和下载按钮
            displayImagesWithDownloadButtons(obj_injectionResults.imgsUrls);

            // 保存信息到本地文件
            savePageInfoToFile(content, lang);
          } else {
            console.error("未能获取页面信息");
            saveDisplay.textContent = "未能获取页面信息，请重试。";
          }

          resetProcessingState();
        }
      );
    });
  });

  function displayImagesWithDownloadButtons(imageUrls) {
    const container = document.getElementById("image-container");
    container.innerHTML = ""; // 清空容器

    imageUrls.forEach((url, index) => {
      const wrapper = document.createElement("div");
      wrapper.style.marginBottom = "10px";

      const img = document.createElement("img");
      img.src = url;
      img.style.maxWidth = "100px";
      img.style.marginRight = "10px";

      const downloadBtn = document.createElement("button");
      downloadBtn.textContent = "下载";
      downloadBtn.onclick = () => downloadImage(url, index);

      wrapper.appendChild(img);
      wrapper.appendChild(downloadBtn);
      container.appendChild(wrapper);
    });

    container.insertAdjacentHTML(
      "beforebegin",
      `<p>图片数量：${imageUrls.length}</p>`
    );
  }

  function downloadImage(url, index) {
    chrome.downloads.download(
      {
        url: url,
        filename: `product_image_${index + 1}.jpg`,
        saveAs: false,
        conflictAction: "uniquify",
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error(`下载图片时出错:`, chrome.runtime.lastError.message);
        } else {
          console.log(`图片下载成功，下载ID: ${downloadId}`);
        }
      }
    );
  }

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

    // TODO: 作用域！！！有待优化
    function _getProductImagesUrls() {
      const gallery = document.querySelector(".productImageGallery");
      if (!gallery) return [];

      const images = gallery.querySelectorAll("img[data-primaryimagesrc]");
      return Array.from(images).map(
        (img) =>
          "https://" + img.getAttribute("data-primaryimagesrc").split("//")[1]
      );
    }
    // const imgsUrls = _getProductImagesUrls().join("\n");
    const imgsUrls = _getProductImagesUrls();

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
  function savePageInfoToFile(content, lang) {
    // 使用 \n 来创建换行
    let formattedContent = content.replace(/\n/g, "\r\n");
    // const dateString = getCurrentDateString();
    alert(`${lang}_${productCode}.txt`)
    chrome.downloads.download({
      filename: `${lang}_${productCode}.txt`,
      saveAs: true,
      conflictAction: "overwrite",
      url:
        "data:text/plain;charset=utf-8," + encodeURIComponent(formattedContent),
    });
  }

  function getCurrentDateString() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }

  function isEnglishPage(url) {
    // 检查URL是否包含'/en/'
    return url.includes("/en/");
  }

  function resetProcessingState() {
    isProcessing = false;
    saveButton.disabled = false; // 重新启用按钮
  }
});
