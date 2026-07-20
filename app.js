const { useState, useMemo } = React;

function App() {
  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fields, setFields] = useState([]);
  
  // 📌 2ファイル管理用のState追加
  const [records2, setRecords2] = useState([]);
  const [headers2, setHeaders2] = useState([]);
  const [fields2, setFields2] = useState([]);
  const [wb1, setWb1] = useState(null);
  const [wb2, setWb2] = useState(null);
  const [paramInfo1, setParamInfo1] = useState({ name: "", kubun: "", total: "" });
  const [paramInfo2, setParamInfo2] = useState({ name: "", kubun: "", total: "" });
  const [isTwoFiles, setIsTwoFiles] = useState(false);
  const [activeTab, setActiveTab] = useState("file1"); // "file1" | "file2"

  const [screen, setScreen] = useState("list");
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [numericFields, setNumericFields] = useState([]);
  const [dateFields, setDateFields] = useState([]);
  // 📌 年月（yyyy/mm）項目を保持するStateを追加
  const [yearMonthFields, setYearMonthFields] = useState([]);

  const [numericFields2, setNumericFields2] = useState([]);
  const [dateFields2, setDateFields2] = useState([]);
  const [yearMonthFields2, setYearMonthFields2] = useState([]);

  const [fileName, setFileName] = useState("");
  const [selectOptions, setSelectOptions] = useState({});
  const [selectOptions2, setSelectOptions2] = useState({});

  // 📌 エラーが発生した項目（インデックス番号）を保持するStateを追加
  const [errorIndices, setErrorIndices] = useState([]);
  // 📌 「入力条件設定」シートのルールを保持するStateを追加
  const [displayRules, setDisplayRules] = useState([]);
  const [displayRules2, setDisplayRules2] = useState([]);

  // ○×判定
  const isBool = (label) => label && label.includes("○") && label.includes("×");

  // 入力タイプ判定
  const getInputType = (headerName, value, isFile2 = false) => {
    const ymList = isFile2 ? yearMonthFields2 : yearMonthFields;
    const dateList = isFile2 ? dateFields2 : dateFields;
    const numList = isFile2 ? numericFields2 : numericFields;

    if (ymList.includes(headerName)) return "month"; // 📌 年月項目の場合はHTMLのmonthタイプを使用
    if (dateList.includes(headerName)) return "date";
    if (numList.includes(headerName)) return "number";
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
  const handleDateChange = (key, rawValue, isMonthType = false, isFile2 = false) => {
    if (!rawValue) {
      updateValue(key, "", isFile2);
      return;
    }
    const formatted = rawValue.replace(/-/g, "/"); // yyyy-mm を yyyy/mm に置換
    updateValue(key, formatted, isFile2);
  };

  // 単一ファイル解析用関数
  const parseSingleFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target.result, { type: "binary", cellNF: true, sheetStubs: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

          if (!rows || rows.length === 0) {
            reject("空のファイルです");
            return;
          }

          const currentHeaders = rows[0] || [];
          const currentFields = rows[1] || [];

          // パラメータ設定シートの読込
          let paramInfo = { name: "", kubun: "", total: "" };
          const paramSheet = wb.Sheets["パラメータ設定"];
          if (paramSheet) {
            const pRows = XLSX.utils.sheet_to_json(paramSheet, { header: 1 });
            paramInfo = {
              name: pRows[1] ? String(pRows[1][0] || "").trim() : "",
              kubun: pRows[2] ? String(pRows[2][0] || "").trim() : "",
              total: pRows[3] ? String(pRows[3][0] || "").trim() : ""
            };
          }

          // 選択肢一覧設定シートの読込
          const optionsSheet = wb.Sheets["選択肢一覧設定"];
          const optionsMap = {};
          if (optionsSheet) {
            const optRows = XLSX.utils.sheet_to_json(optionsSheet);
            optRows.forEach(row => {
              const fid = row["FID"];
              const optionVal = row["選択肢"];
              if (fid && optionVal) {
                if (!optionsMap[fid]) optionsMap[fid] = [];
                if (!optionsMap[fid].includes(optionVal)) optionsMap[fid].push(optionVal);
              }
            });
          }

          // 📌 入力条件設定シートの読込
          const rules = [];
          const condSheet = wb.Sheets["入力条件設定"];
          if (condSheet) {
            const condRows = XLSX.utils.sheet_to_json(condSheet, { header: 1 });
            for (let r = 1; r < condRows.length; r++) {
              const row = condRows[r];
              if (!row || row.length === 0) continue;
              const fid = row[1];       // B列: FID
              const optionVal = row[2]; // C列: 選択肢
              const targetFid = row[4]; // E列: 対象FID
              const groupId = row[5];   // F列: グループID (AND条件用)

              if (fid && optionVal !== undefined && targetFid) {
                rules.push({
                  fid: String(fid).trim(),
                  optionVal: String(optionVal).trim(),
                  targetFid: String(targetFid).trim(),
                  groupId: groupId ? String(groupId).trim() : null
                });
              }
            }
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
                if (hasNumber) numCols.push(h);

                const isRealDate = (formatStr.includes("y") || formatStr.includes("m") || formatStr.includes("d")) && !hasNumberFormat;
                if (isRealDate) {
                  dateCols.push(h);
                }
              }
            }
          });

          // 実データは3行目（インデックス2）から読み込む
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

          resolve({
            wb,
            headers: currentHeaders,
            fields: currentFields,
            records: data,
            numCols,
            dateCols,
            ymCols,
            optionsMap,
            rules,
            paramInfo,
            fileName: file.name
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsBinaryString(file);
    });
  };

  // Excel読込 (1ファイルまたは2ファイル対応)
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!window.XLSX) {
      alert("SheetJSライブラリが読み込まれていません。");
      return;
    }

    try {
      if (files.length === 1) {
        const res = await parseSingleFile(files[0]);
        setWb1(res.wb);
        setHeaders(res.headers);
        setFields(res.fields);
        setRecords(res.records);
        setNumericFields(res.numCols);
        setDateFields(res.dateCols);
        setYearMonthFields(res.ymCols);
        setSelectOptions(res.optionsMap);
        setDisplayRules(res.rules);
        setParamInfo1(res.paramInfo);

        setIsTwoFiles(false);
        setFileName(res.fileName);
        alert("ファイルの読み込み成功しました");
      } else if (files.length >= 2) {
        const parsedFiles = await Promise.all([parseSingleFile(files[0]), parseSingleFile(files[1])]);

        let f1 = parsedFiles[0];
        let f2 = parsedFiles[1];

        // 📌 パラメータ設定シートのチェック
        // 1. 2行目の点検名が両ファイルで一致しているか
        if (f1.paramInfo.name !== f2.paramInfo.name) {
          alert("エラー：2行目の点検名が両ファイルで一致していません。");
          return;
        }

        // 2. 4行目のファイル総数が両ファイルとも「2」か
        if (f1.paramInfo.total !== "2" || f2.paramInfo.total !== "2") {
          alert("エラー：4行目のファイル総数が両ファイルとも「2」ではありません。");
          return;
        }

        // 3. 3行目が「1」と「2」で揃っているか
        const kubuns = [f1.paramInfo.kubun, f2.paramInfo.kubun].sort();
        if (kubuns[0] !== "1" || kubuns[1] !== "2") {
          alert("エラー：3行目の区分が「1」と「2」で揃っていません。");
          return;
        }

        // 区分「1」をファイル1、区分「2」をファイル2として順序を整える
        if (f1.paramInfo.kubun === "2" && f2.paramInfo.kubun === "1") {
          const temp = f1;
          f1 = f2;
          f2 = temp;
        }

        setWb1(f1.wb);
        setHeaders(f1.headers);
        setFields(f1.fields);
        setRecords(f1.records);
        setNumericFields(f1.numCols);
        setDateFields(f1.dateCols);
        setYearMonthFields(f1.ymCols);
        setSelectOptions(f1.optionsMap);
        setDisplayRules(f1.rules);
        setParamInfo1(f1.paramInfo);

        setWb2(f2.wb);
        setHeaders2(f2.headers);
        setFields2(f2.fields);
        setRecords2(f2.records);
        setNumericFields2(f2.numCols);
        setDateFields2(f2.dateCols);
        setYearMonthFields2(f2.ymCols);
        setSelectOptions2(f2.optionsMap);
        setDisplayRules2(f2.rules);
        setParamInfo2(f2.paramInfo);

        setIsTwoFiles(true);
        setFileName(`${f1.fileName}, ${f2.fileName}`);
        alert("ファイルの読み込み成功しました");
      }
    } catch (err) {
      console.error("エクセル読み込みエラー:", err);
      alert("エクセルファイルの読み込みに失敗しました。");
    }
  };

  const updateValue = (key, value, isFile2 = false) => {
    if (isFile2) {
      const newData2 = [...records2];
      newData2[selectedIndex][key] = value;
      setRecords2(newData2);
    } else {
      const newData = [...records];
      newData[selectedIndex][key] = value;
      // 点検完了チェックの場合は両ファイルの完了フラグを同期
      if (key === "_isCompleted" && isTwoFiles && records2[selectedIndex]) {
        const newData2 = [...records2];
        newData2[selectedIndex]._isCompleted = value;
        setRecords2(newData2);
      }
      setRecords(newData);
    }
  };

  // 📌 戻るボタン押下時の必須チェックバリデーション
  const handleBack = () => {
    const currentRec1 = records[selectedIndex];
    const errors = [];

    // 表示されている項目のみをバリデーション対象にするため表示可否判定マップを算出
    const visibleMap1 = getVisibleFieldsMap(currentRec1, false);

    headers.forEach((h, i) => {
      // 非表示項目(◆)や見出し(■)はチェック対象外
      if ((h && h.includes("◆")) || (h && h.includes("■"))) return;

      // 📌 動的表示制御により非表示になっている項目もバリデーション対象外とする
      const currentFid = fields[i];
      if (currentFid && visibleMap1[currentFid] === false) return;

      // 「※」が含まれていて、値が空の場合
      const isRequired = h && h.includes("※");
      const value = currentRec1[h];
      const isEmpty = value === undefined || value === null || String(value).trim() === "";

      if (isRequired && isEmpty) {
        errors.push(i); // エラーが起きた項目のインデックスを記録
      }
    });

    if (errors.length > 0) {
      setErrorIndices(errors);
      alert("必須項目で未入力または未選択箇所があります");
      return; // 画面遷移をストップ
    }

    // エラーがなければクリアして戻る
    setErrorIndices([]);
    setScreen("list");
  };

  // 現在の日時フォーマットを取得 (YYYYMMDD_HHmmss)
  const getFormattedTimestamp = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
  };

  // エクセル単体出力の共通ヘルパー
  const generateExportWorkbook = (targetWb, targetHeaders, targetFields, targetRecords, targetParamInfo) => {
    // 📌 点検完了（緑色）になったカードのレコードのみを抽出
    const completedRecords = targetRecords.filter(r => r._isCompleted);
    if (completedRecords.length === 0) return null;

    const dataRows = completedRecords.map(r => targetHeaders.map(h => r[h] === undefined || r[h] === null ? "" : r[h]));

    const ws = XLSX.utils.aoa_to_sheet([
      targetHeaders, 
      targetFields,
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

    const exportWb = targetWb ? JSON.parse(JSON.stringify(targetWb)) : XLSX.utils.book_new();
    if (exportWb.SheetNames && exportWb.SheetNames.length > 0) {
      exportWb.Sheets[exportWb.SheetNames[0]] = ws;
    } else {
      XLSX.utils.book_append_sheet(exportWb, ws, "インポート用シート");
    }

    const timestamp = getFormattedTimestamp();
    const tenkenName = targetParamInfo.name || "点検結果";
    const kubun = targetParamInfo.kubun || "1";
    const outFileName = `【点検結果】${tenkenName}${kubun}_${timestamp}.xlsx`;

    return { wb: exportWb, fileName: outFileName };
  };

  // Excel出力 (ボタン名: エクセル保存)
  const exportExcel = () => {
    if (!window.XLSX) return;

    const export1 = generateExportWorkbook(wb1, headers, fields, records, paramInfo1);
    
    if (!export1) {
      alert("点検完了しているレコードがありません。");
      return;
    }

    XLSX.writeFile(export1.wb, export1.fileName);

    if (isTwoFiles && records2.length > 0) {
      const export2 = generateExportWorkbook(wb2, headers2, fields2, records2, paramInfo2);
      if (export2) {
        setTimeout(() => {
          XLSX.writeFile(export2.wb, export2.fileName);
        }, 500);
      }
    }
  };

  // 高速化キャッシュ処理 (1ファイル目のレコードのみ一覧表示)
  const renderListCards = useMemo(() => {
    return records.map((rec, i) =>
      React.createElement("div", {
        key: i,
        className: `card ${rec._isCompleted ? "is-completed" : ""}`,
        onClick: () => {
          setSelectedIndex(i);
          setErrorIndices([]); // 📌 詳細画面を開くときはエラー状態をリセット
          setActiveTab("file1"); // 詳細画面を開いたときはタブ1をデフォルト表示
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

  // 📌 「入力条件設定」に基づく動的表示可否の算出ロジック
  const getVisibleFieldsMap = (currentRecord, isFile2 = false) => {
    const targetRules = isFile2 ? displayRules2 : displayRules;
    const targetFields = isFile2 ? fields2 : fields;
    const targetHeaders = isFile2 ? headers2 : headers;

    if (!targetRules || targetRules.length === 0) return {};

    // FIDからヘッダー名を取得するための逆引きマップ作成
    const fidToHeaderMap = {};
    targetFields.forEach((fid, idx) => {
      if (fid) fidToHeaderMap[String(fid).trim()] = targetHeaders[idx];
    });

    // 1行目に「★」が付いている項目のみを表示制御の親項目とする
    const starFids = new Set();
    targetHeaders.forEach((h, idx) => {
      if (h && h.includes("★")) {
        const fid = targetFields[idx];
        if (fid) starFids.add(String(fid).trim());
      }
    });

    // 「入力条件設定」シートのE列（対象FID）に登録されている項目IDの一覧（＝初期状態で制御対象となる項目）
    const controlledTargetFids = new Set(targetRules.map(r => r.targetFid));

    // ルールをグループ単位・および単体（OR）に分類して評価
    const visibleMap = {};
    controlledTargetFids.forEach(tfid => {
      visibleMap[tfid] = false; // 初期状態は非表示
    });

    // 各対象FIDごとにルール群を取得して評価
    controlledTargetFids.forEach(targetFid => {
      const rulesForTarget = targetRules.filter(r => r.targetFid === targetFid);

      // グループ（AND条件）と非グループ（OR条件）に分別
      const groupMap = {};
      const singleRules = [];

      rulesForTarget.forEach(r => {
        if (r.groupId) {
          if (!groupMap[r.groupId]) groupMap[r.groupId] = [];
          groupMap[r.groupId].push(r);
        } else {
          singleRules.push(r);
        }
      });

      let isVisible = false;

      // 1. OR条件（F列空欄）の評価：いずれか1つでも条件に合致すれば表示
      for (const rule of singleRules) {
        if (starFids.has(rule.fid)) {
          const parentHeader = fidToHeaderMap[rule.fid];
          if (parentHeader) {
            const currentVal = String(currentRecord[parentHeader] || "").trim();
            if (currentVal === rule.optionVal) {
              isVisible = true;
              break;
            }
          }
        }
      }

      // 2. AND条件（F列グループID記入）の評価：同一グループ内の全条件を満たせば表示
      if (!isVisible) {
        for (const gid in groupMap) {
          const rulesInGroup = groupMap[gid];
          const allSatisfied = rulesInGroup.every(rule => {
            if (!starFids.has(rule.fid)) return false;
            const parentHeader = fidToHeaderMap[rule.fid];
            if (!parentHeader) return false;
            const currentVal = String(currentRecord[parentHeader] || "").trim();
            return currentVal === rule.optionVal;
          });

          if (allSatisfied) {
            isVisible = true;
            break;
          }
        }
      }

      visibleMap[targetFid] = isVisible;
    });

    return visibleMap;
  };

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
              multiple: true,
              onChange: handleUpload
            }),
            
            fileName && React.createElement("div", { className: "fake-file-input" },
              React.createElement("label", { className: "fake-file-button" }, 
                "ファイルを選択",
                React.createElement("input", { type: "file", multiple: true, onChange: handleUpload, style: { display: "none" } })
              ),
              React.createElement("span", { className: "fake-file-text" }, fileName)
            )
          ),

          renderListCards,
          
          records.length > 0 &&
          React.createElement("button", {
            className: "button",
            onClick: exportExcel
          }, "エクセル保存")
        )
      )
    );
  }

  // 詳細画面用のカレントレコードを取得
  const currentRecord1 = records[selectedIndex];
  const currentRecord2 = isTwoFiles ? records2[selectedIndex] : null;

  const isFile2Active = activeTab === "file2";
  const activeRecord = isFile2Active ? currentRecord2 : currentRecord1;
  const activeHeaders = isFile2Active ? headers2 : headers;
  const activeFields = isFile2Active ? fields2 : fields;
  const activeSelectOptions = isFile2Active ? selectOptions2 : selectOptions;

  // 📌 現在のレコードに対する動的表示制御判定結果を算出
  const visibleFieldsMap = getVisibleFieldsMap(activeRecord, isFile2Active);

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
                checked: !!currentRecord1._isCompleted,
                onChange: (e) => updateValue("_isCompleted", e.target.checked, false)
              }),
              "点検完了"
            )
          )
        ),
        
        React.createElement("div", { className: "floating-card-container" },
          React.createElement("div", { 
            className: `floating-card ${currentRecord1._isCompleted ? "is-completed" : ""}` 
          },
            headers.slice(0, 4).map((h, idx) =>
              React.createElement("div", { key: idx },
                String(currentRecord1[h] || "")
              )
            )
          )
        ),

        // 📌 2ファイル選択時のみタブバーを表示
        isTwoFiles && React.createElement("div", { className: "tab-bar-container" },
          React.createElement("button", {
            className: `tab-button ${activeTab === "file1" ? "active" : ""}`,
            onClick: () => setActiveTab("file1")
          }, "点検詳細01"),
          React.createElement("button", {
            className: `tab-button ${activeTab === "file2" ? "active" : ""}`,
            onClick: () => setActiveTab("file2")
          }, "点検詳細02")
        )
      ),

      React.createElement("div", { className: "container" },
        activeHeaders.map((h, i) => {
          // 📌 項目名に「◆」が含まれている場合は非表示（何もレンダリングしない）
          if (h && h.includes("◆")) {
            return null;
          }

          const currentFid = activeFields[i];

          // 📌 「入力条件設定」シートによる動的表示制御の適用
          // E列（対象FID）に含まれる項目であり、かつ表示条件を満たしていない場合は非表示（nullを返す）
          if (currentFid && visibleFieldsMap[currentFid] === false) {
            return null;
          }

          const rawValue = activeRecord[h] === undefined || activeRecord[h] === null ? "" : activeRecord[h];
          
          const isHeading = h && h.includes("■");

          if (isHeading) {
            return React.createElement("div", {
              key: i,
              className: "card is-heading"
            }, h);
          }

          // 通常の項目の場合
          const type = getInputType(h, rawValue, isFile2Active);
          // 📌 年月型（month）か通常日付型（date）かに応じてフォーマットを切り替える
          const value = (type === "date" || type === "month") ? formatDateForInput(rawValue, type === "month") : rawValue;

          const unitMatch = h && h.match(/『([^』]+)』/);
          const unitText = unitMatch ? unitMatch[1] : null;

          const isSelect = h && h.includes("▼");
          const hasOptions = currentFid && activeSelectOptions[currentFid] && activeSelectOptions[currentFid].length > 0;
          
          // 📌 項目名に「▲」が含まれている場合は入力不可（disabled）にする判定
          const isDisabled = h && h.includes("▲");
          
          // 📌 項目名に「※」が含まれている場合は必須入力項目にする判定
          const isRequired = h && h.includes("※");
          
          // 📌 現在の項目がエラー対象かつ、まだ値が空のままか判定（1ファイル目のみエラーチェック適用）
          const hasError = !isFile2Active && errorIndices.includes(i) && (rawValue === undefined || rawValue === null || String(rawValue).trim() === "");

          let inputElement;

          if (isBool(h)) {
            inputElement = React.createElement("div", { className: "radio-row" },
              React.createElement("label", { className: `radio-item is-maru ${isDisabled ? "is-disabled" : ""}` },
                React.createElement("input", {
                  type: "radio",
                  name: `${h}_${activeTab}`,
                  checked: rawValue === "○",
                  disabled: isDisabled,
                  onChange: () => updateValue(h, "○", isFile2Active)
                }),
                React.createElement("span", null, "○")
              ),
              React.createElement("label", { className: `radio-item is-batsu ${isDisabled ? "is-disabled" : ""}` },
                React.createElement("input", {
                  type: "radio",
                  name: `${h}_${activeTab}`,
                  checked: rawValue === "×",
                  disabled: isDisabled,
                  onChange: () => updateValue(h, "×", isFile2Active)
                }),
                React.createElement("span", null, "×")
              )
            );
          } else if (isSelect && hasOptions) {
            inputElement = React.createElement("select", {
              className: `select-box ${hasError ? "input-error" : ""}`,
              value: rawValue,
              disabled: isDisabled,
              onChange: (e) => updateValue(h, e.target.value, isFile2Active)
            },
              React.createElement("option", { value: "" }, "-- 選択してください --"),
              activeSelectOptions[currentFid].map((opt, idx) => 
                React.createElement("option", { key: idx, value: opt }, opt)
              )
            );
          } else {
            const inputField = React.createElement("input", {
              type: type,
              value: value,
              className: hasError ? "input-error" : "",
              disabled: isDisabled,
              onChange: (e) => {
                if (type === "date" || type === "month") {
                  handleDateChange(h, e.target.value, type === "month", isFile2Active);
                } else {
                  updateValue(h, e.target.value, isFile2Active);
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

          // 📌 エラーメッセージの文言をタイプ別に判定
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
            hasError && React.createElement("div", { className: "error-message-text" }, errorMessage)
          );
        })
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root"))
  .render(React.createElement(App));
