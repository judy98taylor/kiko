document.addEventListener("DOMContentLoaded", function () {
  var saveDisplay = document.getElementById("save-display");
  let keysDisplay = document.getElementById("keys-display");

  var isProcessing = false;
  var productCode;

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (chrome.runtime.lastError) {
      console.error("查询标签页时出错：", chrome.runtime.lastError.message);
      saveDisplay.textContent = "获取页面信息时出错，请重试。";
      return;
    }
    const url = tabs[0].url.split("?")[0];
    if (
      !url.includes("www.hktvmall.com/hktv/zh/main") &&
      !url.includes("www.hktvmall.com/hktv/en/main")
    ) {
      keysDisplay.textContent = "只适用于产品详情页";
    } else {
      showLocalSaveInfo();

      const lang = isEnglishPage(url) ? "en" : "cn";

      const saveButton = document.createElement("button");
      saveButton.textContent = "Save Current Product Info";
      saveButton.style.color = "blue";
      saveDisplay.appendChild(saveButton);
      saveButton.addEventListener("click", function () {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            func: getPageInfo,
          },
          (injectionResults) => {
            if (chrome.runtime.lastError) {
              console.error(
                "执行脚本时出错：",
                chrome.runtime.lastError.message
              );
              saveDisplay.textContent = "获取页面信息时出错，请重试。";
              return;
            }

            if (injectionResults && injectionResults[0]) {
              let obj_injectionResults = injectionResults[0].result;
              let obj_extractInfoFromUrl = extractInfoFromUrl(url);

              let infoObject = {
                categoryPath: obj_extractInfoFromUrl.categoryPath,
                productBrand: obj_injectionResults.productBrand,
                productName: obj_injectionResults.productName,
                shortDesc: obj_injectionResults.shortDesc,
                origin: obj_injectionResults.origin,
              };

              // 保存信息到localStorage
              let infoObject_name =
                "_" +
                obj_extractInfoFromUrl.productShopId +
                "_" +
                obj_extractInfoFromUrl.productSKU;
              saveToLocalStorage(infoObject, lang + infoObject_name);

              // 展示当前保存的信息
              let content = generateContent(infoObject);
              saveDisplay.textContent = content;

              // 展示图片和下载按钮
              showImagesWithDownloadButtons(obj_injectionResults.imgsUrls);

              // 保存信息到本地文件
              // savePageInfoToFile(content, lang);

              showLocalSaveInfo();
            } else {
              console.error("未能获取页面信息");
              saveDisplay.textContent = "未能获取页面信息，请重试。";
            }
          }
        );
      });
    }
  });

  function showLocalSaveInfo() {
    keysDisplay.textContent = "";

    let keys = Object.keys(localStorage);
    if (keys.length > 0) {
      const clearButton = document.createElement("button");
      clearButton.textContent = "Delete the saved data";
      clearButton.style.color = "red";
      keysDisplay.appendChild(clearButton);
      clearButton.onclick = () => {
        localStorage.clear();
        keysDisplay.textContent = "已清除所有";
      };

      const keyList = document.createElement("p");
      keyList.textContent = keys.join(" ; ");
      clearButton.after(keyList);

      function findDifferentPrefixKeys(keys) {
        const cnKeys = keys.filter((key) => key.startsWith("cn_"));
        const enKeys = keys.filter((key) => key.startsWith("en_"));
        const commonSuffixes = cnKeys
          .map((key) => key.substring(3))
          .filter((suffix) => enKeys.some((enKey) => enKey.endsWith(suffix)));
        return commonSuffixes;
      }
      const commonKeys = findDifferentPrefixKeys(keys);
      console.log("找到开头不同后面相同的元素:", commonKeys);

      commonKeys.forEach((key) => {
        const button = document.createElement("button");
        button.textContent = "Download " + key;
        button.style.color = "green";
        keyList.after(button);

        button.onclick = () => {
          const cnKey = localStorage.getItem(`cn_${key}`);
          const enKey = localStorage.getItem(`en_${key}`);
          if (cnKey && enKey) {
            const cnData = JSON.parse(cnKey);
            const enData = JSON.parse(enKey);
            const mergedData = {};
            Object.keys(enData).forEach((key) => {
              mergedData[`${key}_1_en`] = enData[key];
            });
            Object.keys(cnData).forEach((key) => {
              mergedData[`${key}_2_cn`] = cnData[key];
            });
            console.log("合并后的数据:", mergedData);
            const sortedMergedData = sortObjectKeys(mergedData);
            console.log("sort后的数据:", sortedMergedData);
            savePageInfoToFile(generateContent(sortedMergedData), "fullLang");
          }
        };
      });
    }
  }

  function showImagesWithDownloadButtons(imageUrls) {
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

  function savePageInfoToFile(content, lang) {
    // 使用 \n 来创建换行
    let formattedContent = content.replace(/\n/g, "\r\n");
    // const dateString = getCurrentDateString();
    chrome.downloads.download({
      filename: `${lang}_${productCode}.txt`,
      saveAs: true,
      conflictAction: "overwrite",
      url:
        "data:text/plain;charset=utf-8," + encodeURIComponent(formattedContent),
    });
  }

  function saveToLocalStorage(obj, key) {
    localStorage.setItem(key, JSON.stringify(obj));
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

  function sortObjectKeys(obj) {
    // 获取对象的键名
    const keys = Object.keys(obj).sort();

    // 使用 reduce() 方法将排序后的键名和对应值重新组装成对象
    const sortedObj = keys.reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});

    return sortedObj;
  }
});
