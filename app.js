const { useState } = React;

function App() {
  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fields, setFields] = useState([]);
  const [screen, setScreen] = useState("list"); // list or detail
  const [selectedIndex, setSelectedIndex] = useState(null);

  // Excelアップロード
  const handleUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      setHeaders(rows[0]);
      setFields(rows[1]);

      const data = rows.slice(2).map(row => {
        let obj = {};
        rows[0].forEach((h, i) => obj[h] = row[i] || "");
        return obj;
      });

      setRecords(data);
    };

    reader.readAsBinaryString(file);
  };

  // 更新
  const updateValue = (key, value) => {
    const newData = [...records];
    newData[selectedIndex][key] = value;
    setRecords(newData);
  };

  // Excel出力
  const exportExcel = () => {
    const rows = records.map(r => headers.map(h => r[h] || ""));

    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      fields,
      ...rows
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    XLSX.writeFile(wb, "result.xlsx");
  };

  // 一覧画面
  if (screen === "list") {
    return (
      React.createElement("div", null,
        React.createElement("div", { className: "header" }, "点検一覧"),

        React.createElement("div", { className: "container" },

          React.createElement("input", {
            type: "file",
            onChange: handleUpload
          }),

          records.map((rec, i) =>
            React.createElement("div", {
              key: i,
              className: "card",
              onClick: () => {
                setSelectedIndex(i);
                setScreen("detail");
              }
            },
              React.createElement("div", { className: "card-title" },
                rec["事業所名"] || "未設定"
              ),
              React.createElement("div", null,
                rec["系統"] || ""
              ),
              React.createElement("div", null,
                rec["室外機(型式)"] || ""
              )
            )
          )
        )
      )
    );
  }

  // 詳細画面
  return (
    React.createElement("div", null,

      React.createElement("div", { className: "header" }, "点検入力"),

      React.createElement("div", { className: "container" },

        React.createElement("button", {
          className: "button",
          onClick: () => setScreen("list")
        }, "← 戻る"),

        headers.map((h, i) => {
          const value = records[selectedIndex][h] || "";

          return React.createElement("div", {
            key: i,
            className: "card"
          },
            React.createElement("div", { className: "card-title" }, h),

            // ○×ラジオ
            (h.includes("○") && h.includes("×")) && (
              React.createElement("div", { className: "radio-group" },
                React.createElement("label", null,
                  React.createElement("input", {
                    type: "radio",
                    checked: value === "○",
                    onChange: () => updateValue(h, "○")
                  }),
                  " ○"
                ),
                React.createElement("label", null,
                  React.createElement("input", {
                    type: "radio",
                    checked: value === "×",
                    onChange: () => updateValue(h, "×")
                  }),
                  " ×"
                )
              )
            ),

            // 通常入力
            !(h.includes("○") && h.includes("×")) &&
            React.createElement("input", {
              value: value,
              onChange: (e) => updateValue(h, e.target.value)
            })
          );
        }),

        React.createElement("button", {
          className: "button",
          onClick: exportExcel
        }, "Excelダウンロード")
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root"))
  .render(React.createElement(App));
``
