const { useState, useMemo, useRef, useEffect } = React;

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
  // 📌 パラメータ情報のStateに cardColumns（カード表示列数）を追加
  const [paramInfo1, setParamInfo1] = useState({ name: "", kubun: "", total: "", cardColumns: "4" });
  const [paramInfo2, setParamInfo2] = useState({ name: "", kubun: "", total: "", cardColumns: "4" });
  const [isTwoFiles, setIsTwoFiles] = useState(false);
  const [activeTab, setActiveTab] = useState("file1"); // "file1" | "file2"

  const [screen, setScreen] = useState("list"); // "list" | "detail" | "app-version" | "license"
  const [isMenuOpen, setIsMenuOpen] = useState(false); // ハンバーガーメニュー開閉

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
  // 📌 ⑤ 点検詳細02（ファイル2）用のエラー項目Stateを追加
  const [errorIndices2, setErrorIndices2] = useState([]);

  // 📌 「入力条件設定」シートのルールを保持するStateを追加
  const [displayRules, setDisplayRules] = useState([]);
  const [displayRules2, setDisplayRules2] = useState([]);

  // 📌 新規追加 State: 点検業務選択プルダウンと個別のファイル選択表示用
  const [selectedTask, setSelectedTask] = useState("");
  const [file1Obj, setFile1Obj] = useState(null);
  const [file2Obj, setFile2Obj] = useState(null);
  const [file1NameText, setFile1NameText] = useState("点検詳細01が選択されていません");
  const [file2NameText, setFile2NameText] = useState("点検詳細02が選択されていません");
  const [toastMessage, setToastMessage] = useState("");

  const fileInputRef1 = useRef(null);
  const fileInputRef2 = useRef(null);

  // 点検業務プルダウン選択肢リスト
  const taskOptions = [
    { label: "01.エアコン", value: "1" },
    { label: "02.吸収冷温水機", value: "2" },
    { label: "03.冷却塔", value: "3" },
    { label: "04.チラー冷凍機", value: "4" },
    { label: "05.ボイラ・温水", value: "5" },
    { label: "06.ポンプ", value: "6" },
    { label: "08.フロン漏えい点検記録簿", value: "8" },
    { label: "09.フロン簡易点検", value: "9" },
    { label: "14.空気調和機", value: "14" },
    { label: "15.ろ過器", value: "15" },
    { label: "16.ファンコイル", value: "16" },
    { label: "20.ばい煙測定", value: "20" },
    { label: "22.給排気ファン", value: "22" },
    { label: "29.付帯設備点検", value: "29" }
  ];

  // 2つボタンを表示する対象の点検業務値（02, 05, 20）
  const isTwoButtonsTask = ["2", "5", "20"].includes(selectedTask);

  // トースト通知の表示関数
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 4000);
  };

  // 📌 ④ タブごとのスクロール用Refを追加（独立スクロール制御）
  const tab1ScrollRef = useRef(null);
  const tab2ScrollRef = useRef(null);

  // 📌 ② タブ切り替え時および画面表示時にスクロール位置を最上部にリセットする処理
  useEffect(() => {
    if (screen === "detail") {
      if (activeTab === "file1" && tab1ScrollRef.current) {
        tab1ScrollRef.current.scrollTop = 0;
      } else if (activeTab === "file2" && tab2ScrollRef.current) {
        tab2ScrollRef.current.scrollTop = 0;
      }
    }
  }, [activeTab, selectedIndex, screen]);

  // ○×判定
  const isBool = (label) => label && label.includes("○") && label.includes("×") && !label.includes("△");

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
          let paramInfo = { name: "", kubun: "", total: "", cardColumns: "4", a3: "", a6: "" };
          const paramSheet = wb.Sheets["パラメータ設定"];
          if (paramSheet) {
            const pRows = XLSX.utils.sheet_to_json(paramSheet, { header: 1 });
            paramInfo = {
              name: pRows[1] ? String(pRows[1][0] || "").trim() : "",
              kubun: pRows[2] ? String(pRows[2][0] || "").trim() : "",
              total: pRows[3] ? String(pRows[3][0] || "").trim() : "",
              // 📌 A7セル（7行目・インデックス6のA列）からカード表示列数を取得
              cardColumns: pRows[6] && pRows[6][0] !== undefined && pRows[6][0] !== null ? String(pRows[6][0]).trim() : "4",
              a3: pRows[2] ? String(pRows[2][0] || "").trim() : "",
              a6: pRows[5] ? String(pRows[5][0] || "").trim() : ""
            };
          }

          // 初期値設定シートの読込
          const initValuesMap = {};
          const initSheet = wb.Sheets["初期値設定"];
          if (initSheet) {
            const initRows = XLSX.utils.sheet_to_json(initSheet);
            initRows.forEach(row => {
              const fid = row["FID"];
              const val = row["初期値"];
              if (fid !== undefined && fid !== null) {
                initValuesMap[String(fid).trim()] = val !== undefined && val !== null ? val : "";
              }
            });
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
            initValuesMap,
            fileName: file.name
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsBinaryString(file);
    });
  };

  // 点検業務プルダウン変更ハンドラー
  const handleTaskChange = (e) => {
    setSelectedTask(e.target.value);
    // 状態のリセット
    setFile1Obj(null);
    setFile2Obj(null);
    setFile1NameText("点検詳細01が選択されていません");
    setFile2NameText("点検詳細02が選択されていません");
    setRecords([]);
    setRecords2([]);
    setFileName("");
    if (fileInputRef1.current) fileInputRef1.current.value = "";
    if (fileInputRef2.current) fileInputRef2.current.value = "";
  };

  // ファイル選択ボタン1の変更ハンドラー
  const handleFile1Select = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!window.XLSX) {
      alert("SheetJSライブラリが読み込まれていません。");
      return;
    }

    try {
      const res = await parseSingleFile(file);

      // エラーチェック: シート「パラメータ設定」が存在すること
      if (!res.wb.Sheets["パラメータ設定"]) {
        alert("読み込んだエクセルファイルがオフライン専用入力アプリに対応したものではありません");
        e.target.value = "";
        return;
      }

      // エラーチェック: 「パラメータ設定」シート A6セルとプルダウンの選択肢番号の一致
      if (res.paramInfo.a6 !== selectedTask) {
        alert("読み込んだエクセルファイルがプルダウンメニューから選択した点検業務のものではありません");
        e.target.value = "";
        return;
      }

      // 2ボタンの場合の追加チェック: A3セルの値が「1」であること
      if (isTwoButtonsTask) {
        if (res.paramInfo.a3 !== "1") {
          alert("読み込んだエクセルファイルが点検詳細01のものではありません");
          e.target.value = "";
          return;
        }
      }

      // エラーチェック: インポート用シート A3セルに値があること (records[0]の1列目が存在するか)
      const importSheet = res.wb.Sheets[res.wb.SheetNames[0]];
      const importRows = XLSX.utils.sheet_to_json(importSheet, { header: 1 });
      if (!importRows || !importRows[2] || importRows[2][0] === undefined || importRows[2][0] === null || String(importRows[2][0]).trim() === "") {
        alert("読み込んだエクセルファイルが空レコードです");
        e.target.value = "";
        return;
      }

      setFile1Obj(res);
      setFile1NameText(file.name);

      if (!isTwoButtonsTask) {
        // 1ボタンの場合：即時読み込み成功処理
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
        showToast("エクセルファイルの読み込みに成功しました。点検入力を開始してください");
      }
    } catch (err) {
      console.error("1つ目のエクセル読み込みエラー:", err);
      alert("エクセルファイルの読み込みに失敗しました。");
      e.target.value = "";
    }
  };

  // ファイル選択ボタン2の変更ハンドラー
  const handleFile2Select = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // 1つ目のファイルチェック
    if (!file1Obj) {
      alert("1つ目のエクセルファイルが未選択です");
      e.target.value = "";
      return;
    }

    if (!window.XLSX) {
      alert("SheetJSライブラリが読み込まれていません。");
      return;
    }

    try {
      const res2 = await parseSingleFile(file);

      // エラーチェック: シート「パラメータ設定」が存在すること
      if (!res2.wb.Sheets["パラメータ設定"]) {
        alert("読み込んだエクセルファイルがオフライン専用入力アプリに対応したものではありません");
        e.target.value = "";
        return;
      }

      // エラーチェック: 「パラメータ設定」シート A6セルとプルダウンの選択肢番号の一致
      if (res2.paramInfo.a6 !== selectedTask) {
        alert("読み込んだエクセルファイルがプルダウンメニューから選択した点検業務のものではありません");
        e.target.value = "";
        return;
      }

      // エラーチェック: 「パラメータ設定」シート A3セルの値が「2」であること
      if (res2.paramInfo.a3 !== "2") {
        alert("読み込んだエクセルファイルが点検詳細02のものではありません");
        e.target.value = "";
        return;
      }

      // エラーチェック: インポート用シート A3セルに値があること
      const importSheet2 = res2.wb.Sheets[res2.wb.SheetNames[0]];
      const importRows2 = XLSX.utils.sheet_to_json(importSheet2, { header: 1 });
      if (!importRows2 || !importRows2[2] || importRows2[2][0] === undefined || importRows2[2][0] === null || String(importRows2[2][0]).trim() === "") {
        alert("読み込んだエクセルファイルが空レコードです");
        e.target.value = "";
        return;
      }

      setFile2Obj(res2);
      setFile2NameText(file.name);

      // ③ 主キー昇順ソート処理
      let recs1 = [...file1Obj.records];
      let recs2 = [...res2.records];

      const keyCol1 = file1Obj.headers[0];
      const keyCol2 = res2.headers[0];

      recs1.sort((a, b) => Number(a[keyCol1]) - Number(b[keyCol1]));
      recs2.sort((a, b) => Number(a[keyCol2]) - Number(b[keyCol2]));

      // ④ 欠落キーの補填・空レコード挿入＆FID比較コピー＆初期値適用処理
      let updatedRecs2 = [...recs2];

      recs1.forEach((r1) => {
        const val1 = r1[keyCol1];
        if (val1 !== undefined && val1 !== null && val1 !== "") {
          const match = updatedRecs2.find((r2) => String(r2[keyCol2]) === String(val1));
          if (!match) {
            // 空レコード作成
            let emptyRec = { _isCompleted: false };
            res2.headers.forEach((h) => {
              emptyRec[h] = "";
            });

            // 1. 主キー設定
            emptyRec[keyCol2] = val1;

            // 2. 両ファイルで同じFIDを持つ項目へ値をコピー
            file1Obj.fields.forEach((f1, idx1) => {
              if (f1) {
                const targetIdx2 = res2.fields.findIndex((f2) => String(f2).trim() === String(f1).trim());
                if (targetIdx2 !== -1) {
                  const h1 = file1Obj.headers[idx1];
                  const h2 = res2.headers[targetIdx2];
                  emptyRec[h2] = r1[h1] !== undefined ? r1[h1] : "";
                }
              }
            });

            // 3. 「初期値設定」シートのFID参照による初期値設定
            res2.fields.forEach((f2, idx2) => {
              const strF2 = String(f2).trim();
              if (strF2 && res2.initValuesMap[strF2] !== undefined) {
                const h2 = res2.headers[idx2];
                if (emptyRec[h2] === "" || emptyRec[h2] === undefined) {
                  emptyRec[h2] = res2.initValuesMap[strF2];
                }
              }
            });

            updatedRecs2.push(emptyRec);
          }
        }
      });

      // 再度ソート
      updatedRecs2.sort((a, b) => Number(a[keyCol2]) - Number(b[keyCol2]));

      setWb1(file1Obj.wb);
      setHeaders(file1Obj.headers);
      setFields(file1Obj.fields);
      setRecords(recs1);
      setNumericFields(file1Obj.numCols);
      setDateFields(file1Obj.dateCols);
      setYearMonthFields(file1Obj.ymCols);
      setSelectOptions(file1Obj.optionsMap);
      setDisplayRules(file1Obj.rules);
      setParamInfo1(file1Obj.paramInfo);

      setWb2(res2.wb);
      setHeaders2(res2.headers);
      setFields2(res2.fields);
      setRecords2(updatedRecs2);
      setNumericFields2(res2.numCols);
      setDateFields2(res2.dateCols);
      setYearMonthFields2(res2.ymCols);
      setSelectOptions2(res2.optionsMap);
      setDisplayRules2(res2.rules);
      setParamInfo2(res2.paramInfo);

      setIsTwoFiles(true);
      setFileName(`${file1Obj.fileName}\n${res2.fileName}`);
      showToast("エクセルファイルの読み込みに成功しました。点検入力を開始してください");

    } catch (err) {
      console.error("2つ目のエクセル読み込みエラー:", err);
      alert("エクセルファイルの読み込みに失敗しました。");
      e.target.value = "";
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

  // 📌 戻るボタン押下時の必須チェックバリデーション（⑤ 点検詳細02の漏れを修正）
  const handleBack = () => {
    const currentRec1 = records[selectedIndex];
    const errors1 = [];

    // 表示されている項目のみをバリデーション対象にするため表示可否判定マップを算出 (ファイル1)
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
        errors1.push(i); // エラーが起きた項目のインデックスを記録
      }
    });

    // 📌 ⑤ 点検詳細02（2つ目のファイル）のチェック処理追加
    const errors2 = [];
    if (isTwoFiles && records2[selectedIndex]) {
      const currentRec2 = records2[selectedIndex];
      const visibleMap2 = getVisibleFieldsMap(currentRec2, true);

      headers2.forEach((h, i) => {
        if ((h && h.includes("◆")) || (h && h.includes("■"))) return;

        const currentFid = fields2[i];
        if (currentFid && visibleMap2[currentFid] === false) return;

        const isRequired = h && h.includes("※");
        const value = currentRec2[h];
        const isEmpty = value === undefined || value === null || String(value).trim() === "";

        if (isRequired && isEmpty) {
          errors2.push(i);
        }
      });
    }

    if (errors1.length > 0 || errors2.length > 0) {
      setErrorIndices(errors1);
      setErrorIndices2(errors2);

      // エラーが存在するタブへ自動切り替え
      if (errors1.length > 0) {
        setActiveTab("file1");
      } else if (errors2.length > 0) {
        setActiveTab("file2");
      }

      alert("必須項目で未入力または未選択箇所があります");
      return; // 画面遷移をストップ
    }

    // エラーがなければクリアして戻る
    setErrorIndices([]);
    setErrorIndices2([]);
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

  // 📌 アプリ終了時のダイアログ処理
  const handleExitApp = () => {
    setIsMenuOpen(false);
    const confirmed = window.confirm(
      "点検入力アプリを終了しますか？\n(現在点検入力中の内容は破棄されます)"
    );
    if (confirmed) {
      window.location.reload(); // アプリをリセットして初期状態に戻す
    }
  };

  // 高速化キャッシュ処理 (1ファイル目のレコードのみ一覧表示)
  const renderListCards = useMemo(() => {
    // 📌 パラメータ設定のA7セル（cardColumns）から表示する列数を動的に決定（デフォルトは4）
    const colCount = parseInt(paramInfo1.cardColumns, 10) || 4;
    return records.map((rec, i) =>
      React.createElement("div", {
        key: i,
        className: `card ${rec._isCompleted ? "is-completed" : ""}`,
        onClick: () => {
          setSelectedIndex(i);
          setErrorIndices([]); // 📌 詳細画面を開くときはエラー状態をリセット
          setErrorIndices2([]);
          setActiveTab("file1"); // 詳細画面を開いたときはタブ1をデフォルト表示
          setScreen("detail");
        }
      },
        headers.slice(0, colCount).map((h, idx) =>
          React.createElement("div", { key: idx },
            String(rec[h] || "")
          )
        )
      )
    );
  }, [records, headers, paramInfo1.cardColumns]);

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

  // JS内のメニュー描画部分（renderSideMenu）の更新

  // 📌 メニューの開閉アニメーション状態を管理するため、アニメーション用のStateを追加（App関数内に配置）
  const [isMenuAnimating, setIsMenuAnimating] = useState(false);
  
  // メニューを閉じる際のアニメーションハンドラー
  const closeMenuWithAnimation = () => {
    setIsMenuAnimating(true);
    setTimeout(() => {
      setIsMenuOpen(false);
      setIsMenuAnimating(false);
    }, 250); // CSSのアニメーション時間（0.25s）に合わせる
  };
  
  // 📌 サイドメニュー描画ロジックの更新
  const renderSideMenu = () => {
    if (!isMenuOpen) return null;
  
    return React.createElement("div", { 
      className: `menu-overlay ${isMenuAnimating ? "closing" : "active"}`, 
      onClick: closeMenuWithAnimation 
    },
      React.createElement("div", { 
        className: `menu-content ${isMenuAnimating ? "closing" : "active"}`, 
        onClick: (e) => e.stopPropagation() 
      },
        React.createElement("div", { className: "menu-header" }, "メニュー一覧"),
        React.createElement("ul", { className: "menu-list" },
          React.createElement("li", {
            onClick: () => {
              closeMenuWithAnimation();
              setScreen("app-version");
            }
          }, "アプリバージョン情報"),
          React.createElement("li", {
            onClick: () => {
              closeMenuWithAnimation();
              setScreen("license");
            }
          }, "ライセンス情報"),
          React.createElement("li", {
            className: "menu-item-exit",
            onClick: () => {
              closeMenuWithAnimation();
              handleExitApp();
            }
          }, "点検入力アプリを終了する")
        )
      )
    );
  };

  // 📌 アプリバージョン情報画面（固定ヘッダーの下に潜り込まない構造に修正）
  if (screen === "app-version") {
    return (
      React.createElement("div", { className: "info-screen" },
        React.createElement("div", { className: "header" },
          React.createElement("button", {
            className: "header-back-btn",
            onClick: () => setScreen("list")
          }, "＜戻る"),
          "アプリバージョン情報"
        ),
        React.createElement("div", { className: "container info-container" },
          React.createElement("div", { className: "info-card" },
            "アプリバージョン：Ver.1.0.0"
          )
        )
      )
    );
  }

  // 📌 ライセンス情報画面（固定ヘッダーの下に潜り込まない構造に修正）
  if (screen === "license") {
    return (
      React.createElement("div", { className: "info-screen" },
        React.createElement("div", { className: "header" },
          React.createElement("button", {
            className: "header-back-btn",
            onClick: () => setScreen("list")
          }, "＜戻る"),
          "ライセンス情報"
        ),
        React.createElement("div", { className: "container info-container" },
          React.createElement("div", { className: "info-card" },
            "OSSライセンス情報：SheetJS (Apache License 2.0), React (MIT License)"
          )
        )
      )
    );
  }

  // 一覧画面
  if (screen === "list") {
    return (
      React.createElement("div", { className: "list-screen" },
        renderSideMenu(),
        
        // トースト通知表示
        toastMessage && React.createElement("div", { className: "toast-notification" }, toastMessage),

        React.createElement("div", { className: "header" }, 
          React.createElement("button", {
            className: "hamburger-btn",
            onClick: () => setIsMenuOpen(true)
          }, "Ξ"),
          "点検入力アプリ"
        ),
        React.createElement("div", { className: "container" },
          
          /* ①①画面上に「1.点検業務をリストから選択」と説明文をラベル表示 */
          React.createElement("div", { className: "section-label" }, "1.点検業務をリストから選択"),
          
          /* ②プルダウンメニューを設置 */
          React.createElement("select", {
            className: "select-box task-select",
            value: selectedTask,
            onChange: handleTaskChange
          },
            React.createElement("option", { value: "" }, "点検業務を選択"),
            taskOptions.map((opt) => 
              React.createElement("option", { key: opt.value, value: opt.value }, opt.label)
            )
          ),

          /* ③プルダウンメニューから点検業務が選択されたら */
          selectedTask && React.createElement("div", { className: "file-selection-area" },
            React.createElement("div", { className: "section-label" }, "2.読み込むエクセルファイルを選択"),

            /* 1つ目のファイル選択ボタン */
            React.createElement("div", { className: "file-wrapper-box" },
              React.createElement("div", { className: "fake-file-input" },
                React.createElement("label", { className: "fake-file-button" },
                  "ファイル選択",
                  React.createElement("input", {
                    ref: fileInputRef1,
                    type: "file",
                    accept: ".xlsx, .xls",
                    onChange: handleFile1Select,
                    style: { display: "none" }
                  })
                ),
                React.createElement("span", { className: "fake-file-text" }, file1NameText)
              )
            ),

            /* 2つ目のファイル選択ボタン（02, 05, 20選択時のみ表示） */
            isTwoButtonsTask && React.createElement("div", { className: "file-wrapper-box" },
              React.createElement("div", { className: "fake-file-input" },
                React.createElement("label", { className: "fake-file-button" },
                  "ファイル選択",
                  React.createElement("input", {
                    ref: fileInputRef2,
                    type: "file",
                    accept: ".xlsx, .xls",
                    onChange: handleFile2Select,
                    style: { display: "none" }
                  })
                ),
                React.createElement("span", { className: "fake-file-text" }, file2NameText)
              )
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

  // 📌 入力コンポーネント生成ヘルパー
  const renderFieldsList = (targetHeaders, targetFields, targetRecord, targetSelectOptions, targetErrorIndices, isFile2) => {
    const targetVisibleMap = getVisibleFieldsMap(targetRecord, isFile2);

    return targetHeaders.map((h, i) => {
      // 📌 項目名に「◆」が含まれている場合は非表示（何もレンダリングしない）
      if (h && h.includes("◆")) {
        return null;
      }

      const currentFid = targetFields[i];

      // 📌 「入力条件設定」シートによる動的表示制御の適用
      if (currentFid && targetVisibleMap[currentFid] === false) {
        return null;
      }

      const rawValue = targetRecord[h] === undefined || targetRecord[h] === null ? "" : targetRecord[h];
      
      // 📌 「■■」が含まれていれば大見出し、「■」が含まれていれば小見出しとして判定
      const isMainHeading = h && h.includes("■■");
      const isSubHeading = h && !isMainHeading && h.includes("■");

      if (isMainHeading) {
        return React.createElement("div", {
          key: i,
          className: "card is-main-heading"
        }, h);
      }

      if (isSubHeading) {
        return React.createElement("div", {
          key: i,
          className: "card is-sub-heading"
        }, h);
      }

      // 通常の項目の場合
      const type = getInputType(h, rawValue, isFile2);
      const value = (type === "date" || type === "month") ? formatDateForInput(rawValue, type === "month") : rawValue;

      const unitMatch = h && h.match(/『([^』]+)』/);
      const unitText = unitMatch ? unitMatch[1] : null;

      const isSelect = h && h.includes("▼");
      const hasOptions = currentFid && targetSelectOptions[currentFid] && targetSelectOptions[currentFid].length > 0;
      
      const isDisabled = h && h.includes("▲");
      const isRequired = h && h.includes("※");
      
      // 📌 エラー判定
      const hasError = targetErrorIndices.includes(i) && (rawValue === undefined || rawValue === null || String(rawValue).trim() === "");

      let inputElement;

      if (isBool(h)) {
        inputElement = React.createElement("div", { className: "radio-row" },
          React.createElement("label", { className: `radio-item is-maru ${isDisabled ? "is-disabled" : ""}` },
            React.createElement("input", {
              type: "radio",
              name: `${h}_${isFile2 ? "file2" : "file1"}`,
              checked: rawValue === "○",
              disabled: isDisabled,
              onChange: () => updateValue(h, "○", isFile2)
            }),
            React.createElement("span", null, "○")
          ),
          React.createElement("label", { className: `radio-item is-batsu ${isDisabled ? "is-disabled" : ""}` },
            React.createElement("input", {
              type: "radio",
              name: `${h}_${isFile2 ? "file2" : "file1"}`,
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
          targetSelectOptions[currentFid].map((opt, idx) => 
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

  // 詳細画面
  return (
    React.createElement("div", { className: "detail-screen" },
      renderSideMenu(),
      React.createElement("div", { className: "sticky-header" },
        React.createElement("div", { className: "header" }, 
          React.createElement("button", {
            className: "hamburger-btn",
            onClick: () => setIsMenuOpen(true)
          }, "Ξ"),
          "点検詳細入力"
        ),
        React.createElement("div", { className: "action-bar" },
          React.createElement("div", { className: "action-left" },
            React.createElement("button", {
              className: "button-back",
              onClick: handleBack // 📌 チェックロジック
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
            // 📌 パラメータ設定のA7セル（cardColumns）から表示する列数を動的に決定（デフォルトは4）
            headers.slice(0, parseInt(paramInfo1.cardColumns, 10) || 4).map((h, idx) =>
              React.createElement("div", { key: idx },
                String(currentRecord1[h] || "")
              )
            )
          )
        ),

        // 📌 ③ タブボタンのスタイル切り替え（点検詳細01/点検詳細02で色を分ける）
        isTwoFiles && React.createElement("div", { className: "tab-bar-container" },
          React.createElement("button", {
            className: `tab-button tab-01 ${activeTab === "file1" ? "active" : ""}`,
            onClick: () => setActiveTab("file1")
          }, "点検詳細01"),
          React.createElement("button", {
            className: `tab-button tab-02 ${activeTab === "file2" ? "active" : ""}`,
            onClick: () => setActiveTab("file2")
          }, "点検詳細02")
        )
      ),

      /* 📌 ④ 点検詳細01と02のスクロールを独立させた表示領域 */
      React.createElement("div", { className: "detail-content-scroll" },
        // タブ1 (点検詳細01)
        React.createElement("div", {
          ref: tab1ScrollRef,
          className: "tab-scroll-container theme-tab1",
          style: { display: activeTab === "file1" ? "block" : "none" }
        },
          React.createElement("div", { className: "container" },
            renderFieldsList(headers, fields, currentRecord1, selectOptions, errorIndices, false)
          )
        ),

        // タブ2 (点検詳細02)
        isTwoFiles && currentRecord2 && React.createElement("div", {
          ref: tab2ScrollRef,
          className: "tab-scroll-container theme-tab2",
          style: { display: activeTab === "file2" ? "block" : "none" }
        },
          React.createElement("div", { className: "container" },
            renderFieldsList(headers2, fields2, currentRecord2, selectOptions2, errorIndices2, true)
          )
        )
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root"))
  .render(React.createElement(App));
