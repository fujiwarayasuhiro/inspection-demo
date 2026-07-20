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
  // 📌 「入力条件設定」シートのルールを保持するStateを追加
  const [displayRules, setDisplayRules] = useState([]);

  // 📌 2ファイル対応用の追加State
  const [fileCount, setFileCount] = useState(1);
  const [records2, setRecords2] = useState([]);
  const [headers2, setHeaders2] = useState([]);
  const [fields2, setFields2] = useState([]);
  const [numericFields2, setNumericFields2] = useState([]);
  const [dateFields2, setDateFields2] = useState([]);
  const [yearMonthFields2, setYearMonthFields2] = useState([]);
  const [selectOptions2, setSelectOptions2] = useState({});
  const [displayRules2, setDisplayRules2] = useState([]);
  const [errorIndices2, setErrorIndices2] = useState([]);
  const [activeTab, setActiveTab] = useState(1); // 1: 点検詳細01, 2: 点検詳細02
  const [inspectionName, setInspectionName] = useState("");
  const [k区分1, setK区分1] = useState("");
  const [k区分2, setK区分2] = useState("");

  // ○×判定
  const isBool = (label) => label && label.includes("○") && label.includes("×");

  // 入力タイプ判定
  const getInputType = (headerName, value, ymFields = yearMonthFields, dFields = dateFields, numFields = numericFields) => {
    if (ymFields.includes(headerName)) return "month"; // 📌 年月項目の場合はHTMLのmonthタイプを使用
    if (dFields.includes(headerName)) return "date";
    if (numFields.includes(headerName)) return "number";
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

  // 単一ワークブックのデータ解析共通処理
  const parseWorkbook = (wb) => {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows || rows.length === 0) return null;

    const currentHeaders = rows[0] || [];
    const currentFields = rows[1] || [];

    // パラメータ設定シートの読込
    let paramInfo = { name: "", total: "", kubun: "" };
    const paramSheet = wb.Sheets["パラメータ設定"];
    if (paramSheet) {
      const pRows = XLSX.utils.sheet_to_json(paramSheet, { header: 1 });
      if (pRows.length >= 4) {
        paramInfo.name = pRows[1] && pRows[1][1] !== undefined ? String(pRows[1][1]).trim() : "";
        paramInfo.kubun = pRows[2] && pRows[2][1] !== undefined ? String(pRows[2][1]).trim() : "";
        paramInfo.total = pRows[3] && pRows[3][1] !== undefined ? String(pRows[3][1]).trim() : "";
      }
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
    const condSheet = wb.Sheets["入力条件設定"];
    const rules = [];
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

    return {
      headers: currentHeaders,
      fields: currentFields,
      data,
      optionsMap,
      rules,
      numCols,
      dateCols,
      ymCols,
      paramInfo
    };
  };

  // Excel読込 (複数ファイル対応拡張)
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length > 2) {
      alert("ファイル選択は最大2つまでです。");
      return;
    }

    if (!window.XLSX) {
      alert("SheetJSライブラリが読み込まれていません。");
      return;
    }

    try {
      const readAsBinary = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve({ name: file.name, data: evt.target.result });
        reader.onerror = reject;
        reader.readAsBinaryString(file);
      });

      const fileDataList = await Promise.all(files.map(readAsBinary));
      
      let parsedList = fileDataList.map(item => {
        const wb = XLSX.read(item.data, { type: "binary", cellNF: true, sheetStubs: true });
        return { fileName: item.name, parsed: parseWorkbook(wb) };
      });

      if (files.length === 2) {
        // パラメータ検証
        const p1 = parsedList[0].parsed.paramInfo;
        const p2 = parsedList[1].parsed.paramInfo;

        if (!p1.name || !p2.name || p1.name !== p2.name) {
          alert("エラー：両ファイルのパラメータ設定シート（2行目：点検名）が一致していません。");
          return;
        }
        
        // 📌 数値・文字列双方に対応できるよう補正（2または"2"）
        const total1 = String(p1.total).trim();
        const total2 = String(p2.total).trim();
        if (total1 !== "2" || total2 !== "2") {
          alert(`エラー：両ファイルのパラメータ設定シート（4行目：ファイル総数）が「2」ではありません。（読み込み値: [${total1}], [${total2}]）`);
          return;
        }

        const kubun1 = String(p1.kubun).trim();
        const kubun2 = String(p2.kubun).trim();
        const kubuns = [kubun1, kubun2].sort();
        if (kubuns[0] !== "1" || kubuns[1] !== "2") {
          alert(`エラー：パラメータ設定シート（3行目：区分）が「1」と「2」で揃っていません。（読み込み値: [${kubun1}], [${kubun2}]）`);
          return;
        }

        // 区分1、区分2の順序に整列
        if (kubun1 === "2") {
          parsedList.reverse();
        }

        setFileCount(2);
        setFileName(`${parsedList[0].fileName}, ${parsedList[1].fileName}`);
        setInspectionName(parsedList[0].parsed.paramInfo.name);
        setK区分1(parsedList[0].parsed.paramInfo.kubun);
        setK区分2(parsedList[1].parsed.paramInfo.kubun);

        // ファイル1
        setHeaders(parsedList[0].parsed.headers);
        setFields(parsedList[0].parsed.fields);
        setRecords(parsedList[0].parsed.data);
        setSelectOptions(parsedList[0].parsed.optionsMap);
        setDisplayRules(parsedList[0].parsed.rules);
        setNumericFields(parsedList[0].parsed.numCols);
        setDateFields(parsedList[0].parsed.dateCols);
        setYearMonthFields(parsedList[0].parsed.ymCols);

        // ファイル2
        setHeaders2(parsedList[1].parsed.headers);
        setFields2(parsedList[1].parsed.fields);
        setRecords2(parsedList[1].parsed.data);
        setSelectOptions2(parsedList[1].parsed.optionsMap);
        setDisplayRules2(parsedList[1].parsed.rules);
        setNumericFields2(parsedList[1].parsed.numCols);
        setDateFields2(parsedList[1].parsed.dateCols);
        setYearMonthFields2(parsedList[1].parsed.ymCols);

        alert("ファイルの読み込み成功しました");

      } else {
        // 1ファイル時
        const item = parsedList[0];
        setFileCount(1);
        setFileName(item.fileName);
        setInspectionName(item.parsed.paramInfo.name || "点検結果");
        setK区分1(item.parsed.paramInfo.kubun || "");

        setHeaders(item.parsed.headers);
        setFields(item.parsed.fields);
        setRecords(item.parsed.data);
        setSelectOptions(item.parsed.optionsMap);
        setDisplayRules(item.parsed.rules);
        setNumericFields(item.parsed.numCols);
        setDateFields(item.parsed.dateCols);
        setYearMonthFields(item.parsed.ymCols);

        setRecords2([]);
      }
    } catch (err) {
      console.error("エクセル読み込みエラー:", err);
      alert("エクセルファイルの読み込みに失敗しました。");
    }
  };

  const updateValue = (key, value, isFile2 = false) => {
    if (isFile2) {
      const newData = [...records2];
      newData[selectedIndex][key] = value;
      setRecords2(newData);
    } else {
      const newData = [...records];
      newData[selectedIndex][key] = value;
      if (key === "_isCompleted" && fileCount === 2) {
        const newData2 = [...records2];
        if (newData2[selectedIndex]) {
          newData2[selectedIndex]._isCompleted = value;
          setRecords2(newData2);
        }
      }
      setRecords(newData);
    }
  };

  // 📌 戻るボタン押下時の必須チェックバリデーション
  const handleBack = () => {
    const validateFile = (rec, hdrs, flds, rules) => {
      if (!rec) return [];
      const errors = [];
      const visibleMap = getVisibleFieldsMap(rec, hdrs, flds, rules);

      hdrs.forEach((h, i) => {
        // 非表示項目(◆)や見出し(■)はチェック対象外
        if ((h && h.includes("◆")) || (h && h.includes("■"))) return;

        // 📌 動的表示制御により非表示になっている項目もバリデーション対象外とする
        const currentFid = flds[i];
        if (currentFid && visibleMap[currentFid] === false) return;

        // 「※」が含まれていて、値が空の場合
        const isRequired = h && h.includes("※");
        const value = rec[h];
        const isEmpty = value === undefined || value === null || String(value).trim() === "";

        if (isRequired && isEmpty) {
          errors.push(i); // エラーが起きた項目のインデックスを記録
        }
      });
      return errors;
    };

    const errors1 = validateFile(records[selectedIndex], headers, fields, displayRules);
    let errors2 = [];
    if (fileCount === 2) {
      errors2 = validateFile(records2[selectedIndex], headers2, fields2, displayRules2);
    }

    if (errors1.length > 0 || errors2.length > 0) {
      setErrorIndices(errors1);
      setErrorIndices2(errors2);

      if (errors1.length > 0) {
        setActiveTab(1);
      } else if (errors2.length > 0) {
        setActiveTab(2);
      }
      alert("必須項目で未入力または未選択箇所があります");
      return; // 画面遷移をストップ
    }

    // エラーがなければクリアして戻る
    setErrorIndices([]);
    setErrorIndices2([]);
    setActiveTab(1);
    setScreen("list");
  };

  // Excel出力 (点検完了抽出 & 区分ごとのファイル分離出力)
  const exportExcel = () => {
    if (!window.XLSX) return;

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const createAndSaveBook = (hdrs, flds, recs, kubunVal) => {
      const completedRecords = recs.filter(r => r._isCompleted);
      if (completedRecords.length === 0) {
        alert("点検完了としてチェックされたレコードがありません。");
        return false;
      }

      const dataRows = completedRecords.map(r => hdrs.map(h => r[h] === undefined || r[h] === null ? "" : r[h]));

      const ws = XLSX.utils.aoa_to_sheet([
        hdrs, 
        flds,
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

      const kubunSuffix = kubunVal ? `[${kubunVal}]` : "";
      const outFileName = `【点検結果】${inspectionName || "点検結果"}${kubunSuffix}_${dateStr}.xlsx`;
      XLSX.writeFile(wb, outFileName);
      return true;
    };

    const success1 = createAndSaveBook(headers, fields, records, k区分1);
    if (fileCount === 2 && success1) {
      setTimeout(() => {
        createAndSaveBook(headers2, fields2, records2, k区分2);
      }, 500);
    }
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
          setErrorIndices2([]);
          setActiveTab(1);
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
  const getVisibleFieldsMap = (currentRecord, hdrs = headers, flds = fields, rules = displayRules) => {
    if (!rules || rules.length === 0 || !currentRecord) return {};

    // FIDからヘッダー名を取得するための逆引きマップ作成
    const fidToHeaderMap = {};
    flds.forEach((fid, idx) => {
      if (fid) fidToHeaderMap[String(fid).trim()] = hdrs[idx];
    });

    // 1行目に「★」が付いている項目のみを表示制御の親項目とする
    const starFids = new Set();
    hdrs.forEach((h, idx) => {
      if (h && h.includes("★")) {
        const fid = flds[idx];
        if (fid) starFids.add(String(fid).trim());
      }
    });

    // 「入力条件設定」シートのE列（対象FID）に登録されている項目IDの一覧（＝初期状態で制御対象となる項目）
    const controlledTargetFids = new Set(rules.map(r => r.targetFid));

    // ルールをグループ単位・および単体（OR）に分類して評価
    const visibleMap = {};
    controlledTargetFids.forEach(tfid => {
      visibleMap[tfid] = false; // 初期状態は非表示
    });

    // 各対象FIDごとにルール群を取得して評価
    controlledTargetFids.forEach(targetFid => {
      const rulesForTarget = rules.filter(r => r.targetFid === targetFid);

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

  // 詳細入力フォームレンダリング関数
  const renderDetailForm = (isFile2 = false) => {
    const currentRec = isFile2 ? records2[selectedIndex] : records[selectedIndex];
    const currentHdrs = isFile2 ? headers2 : headers;
    const currentFlds = isFile2 ? fields2 : fields;
    const currentOpts = isFile2 ? selectOptions2 : selectOptions;
    const currentRules = isFile2 ? displayRules2 : displayRules;
    const currentErrIndices = isFile2 ? errorIndices2 : errorIndices;

    const ymF = isFile2 ? yearMonthFields2 : yearMonthFields;
    const dF = isFile2 ? dateFields2 : dateFields;
    const numF = isFile2 ? numericFields2 : numericFields;

    // 📌 現在のレコードに対する動的表示制御判定結果を算出
    const visibleFieldsMap = getVisibleFieldsMap(currentRec, currentHdrs, currentFlds, currentRules);

    return currentHdrs.map((h, i) => {
      // 📌 項目名に「◆」が含まれている場合は非表示（何もレンダリングしない）
      if (h && h.includes("◆")) {
        return null;
      }

      const currentFid = currentFlds[i];

      // 📌 「入力条件設定」シートによる動的表示制御の適用
      // E列（対象FID）に含まれる項目であり、かつ表示条件を満たしていない場合は非表示（nullを返す）
      if (currentFid && visibleFieldsMap[currentFid] === false) {
        return null;
      }

      const rawValue = currentRec[h] === undefined || currentRec[h] === null ? "" : currentRec[h];
      
      const isHeading = h && h.includes("■");

      if (isHeading) {
        return React.createElement("div", {
          key: i,
          className: "card is-heading"
        }, h);
      }

      // 通常の項目の場合
      const type = getInputType(h, rawValue, ymF, dF, numF);
      // 📌 年月型（month）か通常日付型（date）かに応じてフォーマットを切り替える
      const value = (type === "date" || type === "month") ? formatDateForInput(rawValue, type === "month") : rawValue;

      const unitMatch = h && h.match(/『([^』]+)』/);
      const unitText = unitMatch ? unitMatch[1] : null;

      const isSelect = h && h.includes("▼");
      const hasOptions = currentFid && currentOpts[currentFid] && currentOpts[currentFid].length > 0;
      
      // 📌 項目名に「▲」が含まれている場合は入力不可（disabled）にする判定
      const isDisabled = h && h.includes("▲");
      
      // 📌 項目名に「※」が含まれている場合は必須入力項目にする判定
      const isRequired = h && h.includes("※");
      
      // 📌 現在の項目がエラー対象かつ、まだ値が空のままか判定
      const hasError = currentErrIndices.includes(i) && (rawValue === undefined || rawValue === null || String(rawValue).trim() === "");

      let inputElement;

      if (isBool(h)) {
        inputElement = React.createElement("div", { className: "radio-row" },
          React.createElement("label", { className: `radio-item is-maru ${isDisabled ? "is-disabled" : ""}` },
            React.createElement("input", {
              type: "radio",
              name: `${isFile2 ? "f2_" : "f1_"}${h}`,
              checked: rawValue === "○",
              disabled: isDisabled,
              onChange: () => updateValue(h, "○", isFile2)
            }),
            React.createElement("span", null, "○")
          ),
          React.createElement("label", { className: `radio-item is-batsu ${isDisabled ? "is-disabled" : ""}` },
            React.createElement("input", {
              type: "radio",
              name: `${isFile2 ? "f2_" : "f1_"}${h}`,
              checked: rawValue === "×",
              disabled: isDisabled,
              onChange: () => updateValue(h, "×", isFile2)
            }),
            React.createElement("span", null, "×")
          )
        );
      } else if (isSelect && hasOptions) {
        inputElement = React.createElement("select", {
          className: `select-box ${hasError ? "input-error" : ""}`,
          value: rawValue,
          disabled: isDisabled,
          onChange: (e) => updateValue(h, e.target.value, isFile2)
        },
          React.createElement("option", { value: "" }, "-- 選択してください --"),
          currentOpts[currentFid].map((opt, idx) => 
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
              handleDateChange(h, e.target.value, type === "month", isFile2);
            } else {
              updateValue(h, e.target.value, isFile2);
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
        hasError && React.createElement("div", { className: "error-message-text" }, errorMessage)
      );
    });
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

        // 2ファイルある場合のタブ切替UI
        fileCount === 2 && React.createElement("div", { className: "tab-container" },
          React.createElement("button", {
            className: `tab-button ${activeTab === 1 ? "active" : ""}`,
            onClick: () => setActiveTab(1)
          }, "点検詳細01"),
          React.createElement("button", {
            className: `tab-button ${activeTab === 2 ? "active" : ""}`,
            onClick: () => setActiveTab(2)
          }, "点検詳細02")
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
        activeTab === 1 ? renderDetailForm(false) : renderDetailForm(true)
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root"))
  .render(React.createElement(App));
