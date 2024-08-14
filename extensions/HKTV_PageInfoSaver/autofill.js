// js自动填表

// contract_no
let contract_no = "H0967001HKTVM1065";
function selectOptionsByContractNo(contractNo = "H0967001HKTVM1065") {
  let select = document.querySelector('select[ng-model="contractId"]');
  if (select) {
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].label.includes(contractNo)) {
        select.selectedIndex = i;
        // 触发change事件
        let event = new Event("change", { bubbles: true });
        select.dispatchEvent(event);
        // 触发Angular的ng-change
        let scope = angular.element(select).scope();
        scope.$apply(function () {
          scope.change_selectContract(select.value);
        });
        break;
      }
    }
  }
}
selectOptionsByContractNo(); // F&M店 default
// selectOptionsByContractNo('H0967002HKTVM1066') // 樱田店

// Stores
let storeId = "6617"; // F&M店 default
// let storeId = '6620' // 樱田店
function selectRadioByStoreId(storeId="6617") {
  let radioButton;
  switch (storeId) {
    case "6617":
      radioButton = document.querySelector('input[type="radio"][value="6617"]'); // F&M店
      break;
    case "6620":
      radioButton = document.querySelector('input[type="radio"][value="6620"]'); // 樱田店
      break;
    // 可以根据需要添加更多的case
    default:
      console.log("未知的storeId:", storeId);
      return;
  }

  if (radioButton) {
    radioButton.checked = true;

    // 触发change事件
    let event = new Event("change", { bubbles: true });
    radioButton.dispatchEvent(event);

    // 触发Angular的ng-change
    let scope = angular.element(radioButton).scope();
    scope.$apply(function () {
      scope.proData.storeRadioChecked = storeId;
      scope.checked_selectStore();
    });
  } else {
    console.log("未找到对应的radio按钮:", storeId);
  }
}
// 使用示例
// selectRadioByStoreId('6617'); // 选择F&M店
// selectRadioByStoreId('6620'); // 选择樱田店

// sku_code
let sku_code = "SD12345";
function FILL_sku_code(sku_code) {
  $$(
    ".form-control.ng-pristine.ng-untouched.ng-valid.ng-empty.ng-valid-maxlength"
  )[0].value = sku_code;
}
FILL_sku_code(sku_code);
