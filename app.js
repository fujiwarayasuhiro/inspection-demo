const { useState, useEffect } = React;

function App() {
  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fields, setFields] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);

  // アップロード処理
  useEffect(() => {
    document.getElementById("upload").addEventListener("change", handleUpload);
    document.getElementById("downloadBtn").addEventListener("click", exportExcel);
  }, [records]);

  function handleUpload(e) {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const headerRow = rows[0];
      const fieldRow = rows[1];
      const dataRows = rows.slice(2);

      const json = dataRows.map(row => {
        let obj = {};
        headerRow.forEach((h, i) => obj[h] = row[i] || "");
        return obj;
      });

      setHeaders(headerRow);
      setFields(fieldRow);
      setRecords(json);
    };

    reader.readAsBinaryString(file);
  }

  // Excel出力
  function exportExcel() {
    const rows = records.map(r => headers.map(h => r[h] || ""));

    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      fields,
      ...rows
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    XLSX.writeFile(wb, "result.xlsx");
  }

  return (
    React.createElement("div", null,

      // カード一覧
      records.map((rec, index) => (
        React.createElement("div", {
          key: index,
          className: "card",
          onClick: () => setSelectedIndex(index)
        },
          React.createElement("div", null, "🏢 " + (rec[headers[1]] || "")),
          React.createElement("div", null, "❄ " + (rec[headers[5]] || ""))
        )
      )),

      // 詳細入力
      selectedIndex !== null &&
      React.createElement("div",
        React.createElement("h3", null, "点検入力"),

        headers.map((h, i) => {
          const value = records[selectedIndex][h] || "";

          return React.createElement("div", {
            key: i,
            className: "card"
          },
            React.createElement("label", null, h),

            // ○×判定
            h.includes("○") || h.includes("×")
              ? React.createElement("div", null,
                  React.createElement("button", {
                    onClick: () => updateValue(h, "○")
                  }, "○"),
                  React.createElement("button", {
                    onClick: () => updateValue(h, "×")
                  }, "×"),
                  React.createElement("div", null, value)
                )
              : React.createElement("input", {
                  value: value,
                  onChange: (e) => updateValue(h, e.target.value)
                })
          );
        })
      )
    )
  );

  function updateValue(key, val) {
    const newData = [...records];
    newData[selectedIndex][key] = val;
    setRecords(newData);
  }
}

ReactDOM.createRoot(document.getElementById("root"))
  .render(React.createElement(App));