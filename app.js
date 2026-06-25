const { useState } = React;

function App() {
  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fields, setFields] = useState([]);
  const [screen, setScreen] = useState("list");
  const [selectedIndex, setSelectedIndex] = useState(null);

  const isBool = (label) => label.includes("○") && label.includes("×");

  const isReadonly = (value) => value === "－";

  const getInputType = (value) => {
    if (!value) return "text";

    if (typeof value === "number" && value > 40000 && value < 50000) {
      return "date";
    }

    if (typeof value === "string" && value.match(/^\d{4}\/\d{1,2}/)) {
      return "date";
    }

    if (!isNaN(value)) return "number";

    return "text";
  };

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

  const updateValue = (key, value) => {
    const newData = [...records];
    newData[selectedIndex][key] = value;
    setRecords(newData);
  };

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
                rec["事業所名"] || ""
              ),
              React.createElement("div", null, rec["系統"] || ""),
              React.createElement("div", null, rec["室外機(型式)"] || "")
            )
          ),

          records.length > 0 &&
          React.createElement("button", {
            className: "button",
            onClick: exportExcel
          }, "Excelダウンロード")
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
