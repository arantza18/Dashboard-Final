import React, { useState } from "react";
import Papa from "papaparse";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const isNullish = (v) =>
  v === null ||
  v === undefined ||
  v === "" ||
  String(v).toLowerCase() === "na" ||
  String(v).toLowerCase() === "nan" ||
  String(v).toLowerCase() === "null";

function inferTypes(rows) {
  const cols = Object.keys(rows[0] || {});
  const types = {};
  for (const col of cols) {
    let numCount = 0,
      total = 0;
    for (const r of rows) {
      const v = r[col];
      if (isNullish(v)) continue;
      total++;
      const n = Number(v);
      if (!Number.isNaN(n) && Number.isFinite(n)) numCount++;
    }
    const ratio = total ? numCount / total : 0;
    types[col] = ratio >= 0.9 ? "numérica" : "categoría";
  }
  return types;
}

function countNulls(rows) {
  const cols = Object.keys(rows[0] || {});
  const nulls = Object.fromEntries(cols.map((c) => [c, 0]));
  for (const r of rows) {
    for (const c of cols) if (isNullish(r[c])) nulls[c]++;
  }
  return nulls;
}

function countDuplicates(rows) {
  const seen = new Map();
  for (const r of rows) {
    const key = JSON.stringify(r);
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  let dups = 0;
  for (const [, cnt] of seen) if (cnt > 1) dups += cnt - 1;
  return dups;
}

function histogram(data) {
  const xs = data.filter((v) => !Number.isNaN(v) && Number.isFinite(v));
  if (xs.length === 0) return { labels: [], counts: [] };
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const k = Math.ceil(Math.sqrt(xs.length));
  const width = (max - min) / (k || 1) || 1;
  const counts = Array(k).fill(0);
  const edges = Array.from({ length: k }, (_, i) => min + i * width);
  for (const x of xs) {
    let idx = Math.floor((x - min) / width);
    if (idx >= k) idx = k - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  const labels = edges.map(
    (e) => `${e.toFixed(2)}–${(e + width).toFixed(2)}`
  );
  return { labels, counts };
}

function topKCounts(values, k = 15) {
  const map = new Map();
  for (const v of values) {
    const key = isNullish(v) ? "(nulo)" : String(v);
    map.set(key, (map.get(key) || 0) + 1);
  }
  const arr = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k);
  return { labels: arr.map(([k]) => k), counts: arr.map(([, v]) => v) };
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState({});
  const [nulls, setNulls] = useState({});
  const [dups, setDups] = useState(0);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      complete: (parsed) => {
        const rowsRaw = parsed.data;
        if (!rowsRaw || rowsRaw.length < 2) return;
        const header = rowsRaw[0].map((h) => String(h).trim());
        const cleanRows = rowsRaw
          .slice(1)
          .map((r) => {
            const obj = {};
            header.forEach((h, i) => (obj[h] = r[i]));
            return obj;
          })
          .filter((r) => Object.values(r).some((v) => !isNullish(v)));

        setRows(cleanRows);
        setTypes(inferTypes(cleanRows));
        setNulls(countNulls(cleanRows));
        setDups(countDuplicates(cleanRows));
      },
      error: (err) => alert("Error al leer CSV: " + err.message),
      skipEmptyLines: true,
    });
  };

  return (
    <div className="p-6 text-slate-100 bg-slate-950 min-h-screen">
      <h1 className="text-2xl font-semibold mb-6">
        Dashboard – Resumen Automático
      </h1>

      <input type="file" accept=".csv" onChange={handleFile} className="mb-6" />

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-900 p-4 rounded">
              <div className="text-sm text-slate-400">Filas</div>
              <div className="text-2xl font-semibold">{rows.length}</div>
            </div>
            <div className="bg-slate-900 p-4 rounded">
              <div className="text-sm text-slate-400">Columnas</div>
              <div className="text-2xl font-semibold">
                {Object.keys(rows[0]).length}
              </div>
            </div>
            <div className="bg-slate-900 p-4 rounded">
              <div className="text-sm text-slate-400">Duplicados</div>
              <div className="text-2xl font-semibold">{dups}</div>
            </div>
          </div>

          <table className="w-full text-sm mb-8">
            <thead className="bg-slate-800/60">
              <tr>
                <th className="text-left px-3 py-2">Columna</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-right px-3 py-2">Nulos</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(types).map((col) => (
                <tr key={col} className="border-t border-slate-800">
                  <td className="px-3 py-2">{col}</td>
                  <td className="px-3 py-2">{types[col]}</td>
                  <td className="px-3 py-2 text-right">
                    {nulls[col] ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Gráfico de nulos */}
          <div className="mb-10">
            <h2 className="mb-3 font-medium">Nulos por columna</h2>
            <Bar
              data={{
                labels: Object.keys(nulls),
                datasets: [
                  {
                    label: "Nulos",
                    data: Object.values(nulls),
                    backgroundColor: "#6366f1",
                  },
                ],
              }}
              options={{ plugins: { legend: { display: false } } }}
            />
          </div>

          {/* Gráficas por columna */}
          <div className="grid md:grid-cols-2 gap-6">
            {Object.keys(types).map((col) => {
              if (types[col] === "numérica") {
                const numeric = rows
                  .map((r) => Number(r[col]))
                  .filter((v) => !Number.isNaN(v) && Number.isFinite(v));
                const { labels, counts } = histogram(numeric);
                return (
                  <div key={col} className="bg-slate-900 p-4 rounded">
                    <h3 className="mb-3 font-medium">{col}</h3>
                    <Bar
                      data={{
                        labels,
                        datasets: [
                          {
                            label: "Frecuencia",
                            data: counts,
                            backgroundColor: "#22c55e",
                          },
                        ],
                      }}
                      options={{
                        plugins: { legend: { display: false } },
                      }}
                    />
                  </div>
                );
              } else {
                const values = rows.map((r) => r[col]);
                const { labels, counts } = topKCounts(values, 15);
                return (
                  <div key={col} className="bg-slate-900 p-4 rounded">
                    <h3 className="mb-3 font-medium">{col}</h3>
                    <Bar
                      data={{
                        labels,
                        datasets: [
                          {
                            label: "Conteo (Top 15)",
                            data: counts,
                            backgroundColor: "#f59e0b",
                          },
                        ],
                      }}
                      options={{
                        plugins: { legend: { display: false } },
                      }}
                    />
                  </div>
                );
              }
            })}
          </div>
        </>
      )}
    </div>
  );
}

