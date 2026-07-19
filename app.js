const { useState, useMemo } = React;

function App() {
  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fields, setFields] = useState([]);
  const [screen, setScreen] = useState("list");
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [numericFields, setNumericFields] = useState([]);
  const [dateFields, setDateFields] = useState([]);
  // 📌 年月（yyyy/mm）項目を保持するStateを追加
  const [yearMonthFields, setYearMonthFields] = useState([]);
  const [fileName, setFileName] = useState("");
  const [selectOptions, setSelectOptions] = useState({});
  // 📌 エラーが発生した項目（インデックス番号）を保持するStateを追加
  const [errorIndices, setErrorIndices] = useState([]);

  // ○×判定
  const isBool = (label) => label && label.includes("○") && label.includes("×");

  // 入力タイプ判定
  const getInputType = (headerName, value) => {
    if (yearMonthFields.includes(headerName)) return "month"; // 📌 年月項目の場合はHTMLのmonthタイプを使用
    if (dateFields.includes(headerName)) return "date";
    if (numericFields.includes(headerName)) return "number";
    if (!value) return "text";
    
    if (typeof value === "number" && value > 40000 && value < 50000) return "date";
    if (typeof value === "string" && value.match(/^\d{4}\/\d{1,2}/)) {
      // 読み込み時文字列かつスラッシュ2個（日含む）か1個（年月のみ）かで分岐可能
      return value.split("/").length === 2 ? "month" : "date";
    }
    
    if (typeof value === "number" || (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value))) return "number";

    return "text";
  };
  
  // 📌 画面表示・入力欄（<input type="date/month">）に渡す値のフォーマット変換
  function formatDateForInput(value, isMonthType = false) {
    if (!value) return "";
    if (typeof value === "number") {
      const date = new Date((value - 25569) * 86400 * 1000);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      if (isMonthType) {
        return `${y}-${m}`; // month型は yyyy-mm 形式必要
      }
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`; // date型は yyyy-mm-dd 形式必要
    }
    if (typeof value === "string" && value.match(/^\d{4}\/\d{1,2}/)) {
      const parts = value.split("/");
      const y = parts[0];
      const m = (parts[1] || "").padStart(2, "0");
      if (isMonthType) {
        return `${y}-${m}`;
      }
      const d = (parts[2] || "01").padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return value;
  }

  // 📌 画面で日付・年月が変更された際のデータ保存処理
  const handleDateChange = (key, rawValue, isMonthType = false) => {
    if (!rawValue) {
      updateValue(key, "");
      return;
    }
    const formatted = rawValue.replace(/-/g, "/"); // yyyy-mm を yyyy/mm に置換
    updateValue(key, formatted);
  };

  // Excel読込
  const handleUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        if (!window.XLSX) {
          alert("SheetJSライブラリが読み込まれていません。");
          return;
        }
        const wb = XLSX.read(evt.target.result, { type: "binary", cellNF: true, sheetStubs: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rows || rows.length === 0) return;

        const currentHeaders = rows[0] || [];
        const currentFields = rows[1] || [];
        
        setHeaders(currentHeaders);
        setFields(currentFields);

        // 選択肢一覧設定シートの読込
        const optionsSheet = wb.Sheets["選択肢一覧設定"];
        if (optionsSheet) {
          const optRows = XLSX.utils.sheet_to_json(optionsSheet);
          const optionsMap = {};
          optRows.forEach(row => {
            const fid = row["FID"];
            const optionVal = row["選択肢"];
            if (fid && optionVal) {
              if (!optionsMap[fid]) optionsMap[fid] = [];
              if (!optionsMap[fid].includes(optionVal)) optionsMap[fid].push(optionVal);
            }
          });
          setSelectOptions(optionsMap);
        }

        let numCols = [];
        let dateCols = []; 
        let ymCols = []; // 📌 年月項目用の配列
        
        currentHeaders.forEach((h, i) => {
          const cellAddress = XLSX.utils.encode_cell({ r: 2, c: i });
          const cell = ws[cellAddress];
          if (cell && cell.z) {
            const formatStr = String(cell.z).toLowerCase();
            const hasNumberFormat = formatStr.includes("0") || formatStr.includes("#");
            
            // 📌 年月表記（yとmがあり、dが含まれない）のセル書式を判定
            const isYearMonth = formatStr.includes("y") && formatStr.includes("m") && !formatStr.includes("d");
            
            if (isYearMonth) {
              ymCols.push(h);
            } else {
              const hasNumber = hasNumberFormat;
              const isNotDate = !formatStr.includes("y") && !formatStr.includes("m") && !formatStr.includes("d");
              if (hasNumber && isNotDate) numCols.push(h);

              const isRealDate = (formatStr.includes("y") || formatStr.includes("m") || formatStr.includes("d")) && !hasNumberFormat;
              if (isRealDate) {
                dateCols.push(h);
              }
            }
          }
        });
        setNumericFields(numCols);
        setDateFields(dateCols); 
        setYearMonthFields(ymCols); // 📌 年月判定結果を設定

        const data = rows.slice(2).map(row => {
          let obj = {};
          obj._isCompleted = false; 

          currentHeaders.forEach((h, i) => {
            let val = row[i] === undefined || row[i] === null ? "" : row[i];
            
            // シリアル値の日付変換処理
            if (typeof val === "number" && val > 40000 && val < 50000 && !numCols.includes(h)) {
              const date = new Date((val - 25569) * 86400 * 1000);
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, "0");
              
              if (ymCols.includes(h)) {
                val = `${y}/${m}`; // 📌 年月項目の場合は「yyyy/mm」の文字列にする
              } else {
                const d = String(date.getDate()).padStart(2, "0");
                val = `${y}/${m}/${d}`;
              }
            }
            obj[h] = val;
          });
          return obj;
        });

        setRecords(data);
      } catch (err) {
        console.error("エクセル読み込みエラー:", err);
        alert("エクセルファイルの読み込みに失敗しました。");
      }
    };

    reader.readAsBinaryString(file);
  };

  const updateValue = (key, value) => {
    const newData = [...records];
    newData[selectedIndex][key] = value;
    setRecords(newData);
  };

  // 📌 戻るボタン押下時の必須チェックバリデーション
  const handleBack = () => {
    const currentRec = records[selectedIndex];
    const errors = [];

    headers.forEach((h, i) => {
      // 非表示項目(◆)や見出し(■)はチェック対象外
      if ((h && h.includes("◆")) || (h && h.includes("■"))) return;

      // 「※」が含まれていて、値が空の場合
      const isRequired = h && h.includes("※");
      const value = currentRec[h];
      const isEmpty = value === undefined || value === null || String(value).trim() === "";

      if (isRequired && isEmpty) {
        errors.push(i); // エラーが起きた項目のインデックスを記録
      }
    });

    if (errors.length > 0) {
      setErrorIndices(errors);
      alert("必須入力項目で未入力箇所があります");
      return; // 画面遷移をストップ
    }

    // エラーがなければクリアして戻る
    setErrorIndices([]);
    setScreen("list");
  };

  // Excel出力
  const exportExcel = () => {
    if (!window.XLSX) return;
    
    const dataRows = records.map(r => headers.map(h => r[h] === undefined || r[h] === null ? "" : r[h]));

    const ws = XLSX.utils.aoa_to_sheet([
      headers, 
      fields,
      ...dataRows 
    ]);

    Object.keys(ws).forEach(cellRef => {
      if (cellRef.startsWith("!")) return;
      const cell = ws[cellRef];
      if (cell && cell.v && typeof cell.v === "string") {
        
        // 📌 ① 年月形式（yyyy/mm）の出力復元処理
        if (cell.v.match(/^\d{4}\/\d{1,2}$/)) {
          const parts = cell.v.split("/");
          const year = Number(parts[0]);
          const month = Number(parts[1]);
          // 年月のみの場合は、該当月の「1日」の昼12時を基準としてシリアル値を生成
          const dateObj = new Date(year, month - 1, 1, 12, 0, 0);
          if (!isNaN(dateObj.getTime())) {
            cell.t = "n"; 
            cell.v = Math.floor((dateObj.getTime() / (86400 * 1000)) + 25569); 
            cell.z = "yyyy/mm"; // 📌 書式設定を年月表記に固定して出力
          }
        } 
        // ② 通常の日付形式（yyyy/mm/dd）の出力復元処理
        else if (cell.v.match(/^\d{4}\/\d{1,2}\/\d{1,2}/)) {
          const parts = cell.v.split("/");
          const year = Number(parts[0]);
          const month = Number(parts[1]);
          const day = Number(parts[2]);
          const dateObj = new Date(year, month - 1, day, 12, 0, 0);
          if (!isNaN(dateObj.getTime())) {
            cell.t = "n"; 
            cell.v = Math.floor((dateObj.getTime() / (86400 * 1000)) + 25569); 
            cell.z = "yyyy/mm/dd"; 
          }
        }
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "result.xlsx");
  };

  // 高速化キャッシュ処理
  const renderListCards = useMemo(() => {
    return records.map((rec, i) =>
      React.createElement("div", {
        key: i,
        className: `card ${rec._isCompleted ? "is-completed" : ""}`,
        onClick: () => {
          setSelectedIndex(i);
          setErrorIndices([]); // 📌 詳細画面を開くときはエラー状態をリセット
          setScreen("detail");
        }
      },
        headers.slice(0, 4).map((h, idx) =>
          React.createElement("div", { key: idx },
            String(rec[h] || "")
          )
        )
      )
    );
  }, [records, headers]);

  // 一覧画面
  if (screen === "list") {
    return (
      React.createElement("div", { className: "list-screen" },
        React.createElement("div", { className: "header" }, 
          React.createElement("span", { className: "header-ver" }, "Ver.1.0.0"),
          "点検入力アプリ"
        ),
        React.createElement("div", { className: "container" },
          
          React.createElement("div", { className: "file-wrapper-box" },
            !fileName && React.createElement("input", {
              type: "file",
              onChange: handleUpload
            }),
            
            fileName && React.createElement("div", { className: "fake-file-input" },
              React.createElement("label", { className: "fake-file-button" }, 
                "ファイルを選択",
                React.createElement("input", { type: "file", onChange: handleUpload, style: { display: "none" } })
              ),
              React.createElement("span", { className: "fake-file-text" }, fileName)
            )
          ),

          renderListCards,
          
          records.length > 0 &&
          React.createElement("button", {
            className: "button",
            onClick: exportExcel
          }, "Excelダウンロード")
        )
      )
    );
  }

  // 詳細画面用のカレントレコードを取得
  const currentRecord = records[selectedIndex];

  // 詳細画面
  return (
    React.createElement("div", { className: "detail-screen" },
      React.createElement("div", { className: "sticky-header" },
        React.createElement("div", { className: "header" }, 
          React.createElement("span", { className: "header-ver" }, "Ver.1.0.0"),
          "点検詳細入力"
        ),
        React.createElement("div", { className: "action-bar" },
          React.createElement("div", { className: "action-left" },
            React.createElement("button", {
              className: "button-back",
              onClick: handleBack // 📌 チェックロジックへ変更
            }, "← 戻る")
          ),
          React.createElement("div", { className: "action-center" },
            `${selectedIndex + 1} ／ ${records.length}`
          ),
          React.createElement("div", { className: "action-right" },
            React.createElement("label", { className: "complete-checkbox-label" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!currentRecord._isCompleted,
                onChange: (e) => updateValue("_isCompleted", e.target.checked)
              }),
              "点検完了"
            )
          )
        ),
        
        React.createElement("div", { className: "floating-card-container" },
          React.createElement("div", { 
            className: `floating-card ${currentRecord._isCompleted ? "is-completed" : ""}` 
          },
            headers.slice(0, 4).map((h, idx) =>
              React.createElement("div", { key: idx },
                String(currentRecord[h] || "")
              )
            )
          )
        )
      ),

      React.createElement("div", { className: "container" },
        headers.map((h, i) => {
          // 📌 項目名に「◆」が含まれている場合は非表示（何もレンダリングしない）
          if (h && h.includes("◆")) {
            return null;
          }

          const rawValue = currentRecord[h] === undefined || currentRecord[h] === null ? "" : currentRecord[h];
          const currentFid = fields[i]; 
          
          const isHeading = h && h.includes("■");

          if (isHeading) {
            return React.createElement("div", {
              key: i,
              className: "card is-heading"
            }, h);
          }

          // 通常の項目の場合
          const type = getInputType(h, rawValue);
          // 📌 年月型（month）か通常日付型（date）かに応じてフォーマットを切り替える
          const value = (type === "date" || type === "month") ? formatDateForInput(rawValue, type === "month") : rawValue;

          const unitMatch = h && h.match(/『([^』]+)』/);
          const unitText = unitMatch ? unitMatch[1] : null;

          const isSelect = h && h.includes("▼");
          const hasOptions = currentFid && selectOptions[currentFid] && selectOptions[currentFid].length > 0;
          
          // 📌 項目名に「▲」が含まれている場合は入力不可（disabled）にする判定
          const isDisabled = h && h.includes("▲");
          
          // 📌 項目名に「※」が含まれている場合は必須入力項目にする判定
          const isRequired = h && h.includes("※");
          
          // 📌 現在の項目がエラー対象かつ、まだ値が空のままか判定
          const hasError = errorIndices.includes(i) && (rawValue === undefined || rawValue === null || String(rawValue).trim() === "");

          let inputElement;

          if (isBool(h)) {
            inputElement = React.createElement("div", { className: "radio-row" },
              React.createElement("label", { className: `radio-item is-maru ${isDisabled ? "is-disabled" : ""}` },
                React.createElement("input", {
                  type: "radio",
                  name: h,
                  checked: rawValue === "○",
                  disabled: isDisabled, // 📌 入力不可を設定
                  onChange: () => updateValue(h, "○")
                }),
                React.createElement("span", null, "○")
              ),
              React.createElement("label", { className: `radio-item is-batsu ${isDisabled ? "is-disabled" : ""}` },
                React.createElement("input", {
                  type: "radio",
                  name: h,
                  checked: rawValue === "×",
                  disabled: isDisabled, // 📌 入力不可を設定
                  onChange: () => updateValue(h, "×")
                }),
                React.createElement("span", null, "×")
              )
            );
          } else if (isSelect && hasOptions) {
            inputElement = React.createElement("select", {
              className: `select-box ${hasError ? "input-error" : ""}`, // 📌 エラー時用の枠線赤クラス
              value: rawValue,
              disabled: isDisabled, // 📌 入力不可を設定
              onChange: (e) => updateValue(h, e.target.value)
            },
              React.createElement("option", { value: "" }, "-- 選択してください --"),
              selectOptions[currentFid].map((opt, idx) => 
                React.createElement("option", { key: idx, value: opt }, opt)
              )
            );
          } else {
            const inputField = React.createElement("input", {
              type: type,
              value: value,
              className: hasError ? "input-error" : "", // 📌 エラー時用の枠線赤クラス
              disabled: isDisabled, // 📌 入力不可を設定
              onChange: (e) => {
                // 📌 date型またはmonth型の場合は共通 of チェンジハンドラへ送る
                if (type === "date" || type === "month") {
                  handleDateChange(h, e.target.value, type === "month");
                } else {
                  updateValue(h, e.target.value);
                }
              }
            });

            if (unitText) {
              inputElement = React.createElement("div", { className: "input-with-unit" },
                inputField,
                React.createElement("span", { className: "input-unit-text" }, unitText)
              );
            } else {
              inputElement = inputField;
            }
          }

          return React.createElement("div", {
            key: i,
            className: `card ${isDisabled ? "is-disabled-card" : ""} ${hasError ? "card-error" : ""}` // 📌 エラー用のカード枠線スタイルを追加
          },
            React.createElement("div", { className: "card-title-row" }, // 📌 タイトルとバッジの横並び用レイアウトに変更
              React.createElement("div", { className: "card-title" }, h),
              isRequired && React.createElement("span", { className: "required-badge" }, "必須") // 📌 必須バッジ表示
            ),
            // 📌 エラーメッセージの文言をタイプ別に判定
            // ラジオボタン(isBool)、プルダウン(isSelect)、日付・年月(date/month) は「未選択です」
            const isSelectionType = isBool(h) || isSelect || type === "date" || type === "month";
            const errorMessage = isSelectionType ? "未選択です" : "未入力です";

            return React.createElement("div", {
              key: i,
              className: `card ${isDisabled ? "is-disabled-card" : ""} ${hasError ? "card-error" : ""}`
            },
              React.createElement("div", { className: "card-title-row" },
                React.createElement("div", { className: "card-title" }, h),
                isRequired && React.createElement("span", { className: "required-badge" }, "必須")
              ),
              inputElement,
              // 📌 判定したメッセージ文言（未選択です / 未入力です）を動的に表示
              hasError && React.createElement("div", { className: "error-message-text" }, errorMessage)
            );
        })
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root"))
  .render(React.createElement(App));
