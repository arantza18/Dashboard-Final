
import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Upload, Database, BarChart3, Trash2, FileDown } from "lucide-react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart as RLineChart,
  Line,
  CartesianGrid,
  ScatterChart as RScatterChart,
  Scatter,
} from "recharts";

// Adecua al Django del repo: mismo dominio por defecto; permite override con VITE_API_BASE_URL
const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin; // usa el backend Django del repo

function classNames(...cn) { return cn.filter(Boolean).join(" "); }

function detectTypes(rows) {
  if (!rows || rows.length === 0) return { numeric: [], categorical: [] };
  const headers = Object.keys(rows[0] || {});
  const numeric = [], categorical = [];
  for (const h of headers) {
    let nums = 0, non = 0;
    for (let i = 0; i < Math.min(rows.length, 100); i++) {
      const v = rows[i]?.[h];
      if (v === null || v === undefined || v === "") continue;
      const num = Number(v);
      if (!Number.isNaN(num) && String(v).trim().match(/^[-+]?\d+(\.\d+)?$/)) nums++; else non++;
    }
    (nums > non ? numeric : categorical).push(h);
  }
  return { numeric, categorical };
}

function computeSummary(rows) {
  if (!rows || rows.length === 0) return {};
  const headers = Object.keys(rows[0] || {});
  const summary = {};
  for (const h of headers) {
    const vals = rows.map(r => r[h]).filter(v => v !== null && v !== undefined && v !== "");
    const nums = vals.map(Number).filter(v => !Number.isNaN(v));
    const isNum = nums.length >= vals.length * 0.6;
    if (isNum) {
      const sorted = [...nums].sort((a,b)=>a-b);
      const n = sorted.length;
      const mean = sorted.reduce((a,b)=>a+b,0)/Math.max(n,1);
      const min = sorted[0] ?? null;
      const max = sorted[n-1] ?? null;
      const q = p => sorted[Math.floor((n-1)*p)];
      summary[h] = { type:"num", count:n, mean, min, q25:q(0.25), median:q(0.5), q75:q(0.75), max };
    } else {
      const counts = {};
      for (const v of vals) counts[v] = (counts[v]||0)+1;
      const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
      summary[h] = { type:"cat", count:vals.length, distinct:Object.keys(counts).length, top };
    }
  }
  return summary;
}

function buildHistogram(rows, col, bins = 10) {
  const nums = rows.map(r => Number(r[col])).filter(v => !Number.isNaN(v));
  if (nums.length === 0) return [];
  const min = Math.min(...nums), max = Math.max(...nums);
  const width = (max - min) / bins || 1;
  const arr = new Array(bins).fill(0);
  for (const v of nums) {
    let idx = Math.floor((v - min) / width);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    arr[idx]++;
  }
  return arr.map((c, i) => ({ bin: `${(min + i*width).toFixed(2)}-${(min + (i+1)*width).toFixed(2)}`, count: c }));
}

// CSRF helper para Django
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

async function fetchJSON(path) {
  const res = await fetch(API_BASE + path, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postDataset(name, file) {
  const form = new FormData();
  form.append("name", name || file.name);
  form.append("file", file);
  const csrf = getCookie('csrftoken');
  const res = await fetch(API_BASE + "/api/datasets/", {
    method: "POST",
    credentials: 'include',
    headers: csrf ? { 'X-CSRFToken': csrf } : undefined,
    body: form
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function DashboardApp() {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [types, setTypes] = useState({ numeric: [], categorical: [] });
  const [summary, setSummary] = useState({});
  const [name, setName] = useState("");
  const [datasets, setDatasets] = useState([]);
  const [xCol, setXCol] = useState("");
  const [yCol, setYCol] = useState("");
  const [chart, setChart] = useState("barras");
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const numericHeaders = types.numeric;
  const categoricalHeaders = types.categorical;

  const handleFiles = (f) => {
    if (!f || f.length === 0) return;
    const picked = f[0];
    setFile(picked);
    setError("");
    setLoading(true);
    Papa.parse(picked, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data || [];
        setRows(data);
        const hs = Object.keys(data[0] || {});
        setHeaders(hs);
        const t = detectTypes(data);
        setTypes(t);
        setSummary(computeSummary(data));
        setXCol(hs[0] || "");
        setYCol(t.numeric[0] || hs[1] || "");
        setLoading(false);
      },
      error: (err) => {
        setError(String(err));
        setLoading(false);
      }
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const onBrowse = () => inputRef.current?.click();

  const loadServerDatasets = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await fetchJSON("/api/datasets/");
      setDatasets(data || []);
    } catch (e) {
      setError("No se pudieron cargar datasets del backend (opcional). Verifica API_BASE.");
    } finally { setLoading(false); }
  };

  const saveToBackend = async () => {
    if (!file) return;
    try {
      setLoading(true);
      setError("");
      const res = await postDataset(name || file.name, file);
      setName("");
      await loadServerDatasets();
      alert(`Dataset guardado: ${res?.name || "OK"}`);
    } catch (e) {
      setError("No se pudo guardar en el backend. Asegura /api/datasets en Django/DRF.");
    } finally { setLoading(false); }
  };

  const downloadCSV = () => {
    if (!rows?.length) return;
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = (name || file?.name || "dataset") + "-limpio.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const scatterData = useMemo(() => {
    if (!rows?.length || !xCol || !yCol) return [];
    return rows.map(r => ({ x: Number(r[xCol]), y: Number(r[yCol]) }))
      .filter(p => !Number.isNaN(p.x) && !Number.isNaN(p.y));
  }, [rows, xCol, yCol]);

  const barrasData = useMemo(() => {
    if (!rows?.length || !xCol) return [];
    // para categóricas: conteo; para numéricas: histograma
    if (categoricalHeaders.includes(xCol)) {
      const counts = {};
      for (const r of rows) {
        const v = r[xCol];
        counts[v ?? "(nulo)"] = (counts[v ?? "(nulo)"] || 0) + 1;
      }
      return Object.entries(counts).map(([k, v]) => ({ key: String(k), value: v }));
    } else {
      return buildHistogram(rows, xCol, 12).map(b => ({ key: b.bin, value: b.count }));
    }
  }, [rows, xCol, categoricalHeaders]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <motion.h1 initial={{opacity:0, y:-8}} animate={{opacity:1, y:0}} className="text-3xl font-bold tracking-tight mb-6">
        Dashboard dinámico • Upload de bases de datos
      </motion.h1>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Panel de carga */}
        <Card className="xl:col-span-1 shadow-lg rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Upload className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Subir dataset (CSV)</h2>
            </div>

            <div onDragOver={(e)=>e.preventDefault()} onDrop={onDrop}
                 className="border-2 border-dashed rounded-2xl p-6 text-center bg-white">
              <p className="mb-2">Arrastra tu archivo aquí o</p>
              <Button onClick={onBrowse} type="button">Buscar archivo</Button>
              <input ref={inputRef} type="file" accept=".csv" className="hidden"
                     onChange={(e)=> handleFiles(e.target.files)} />
              {file && (
                <p className="text-sm mt-3">Seleccionado: <span className="font-medium">{file.name}</span></p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="dsname">Nombre (opcional)</Label>
                <Input id="dsname" placeholder="MiDataset" value={name} onChange={e=>setName(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button onClick={downloadCSV} type="button" className="w-full" disabled={!rows?.length}>
                  <FileDown className="h-4 w-4 mr-2"/> Descargar CSV
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={saveToBackend} disabled={!file}>
                Guardar en backend
              </Button>
              <Button variant="secondary" onClick={loadServerDatasets}>
                Cargar datasets del backend
              </Button>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}
            {loading && <p className="text-slate-600 text-sm">Procesando...</p>}

            {!!datasets.length && (
              <div>
                <h3 className="font-semibold mb-2">Datasets guardados</h3>
                <ul className="text-sm max-h-40 overflow-auto space-y-1">
                  {datasets.map((d)=> (
                    <li key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <span>{d.name || `dataset ${d.id}`}</span>
                      <Button size="sm" variant="outline" onClick={()=>window.open(`${API_BASE}/api/datasets/${d.id}`,'_blank')}>ver</Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel de exploración y visualización */}
        <Card className="xl:col-span-2 shadow-lg rounded-2xl">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Exploración y gráficas</h2>
            </div>

            <Tabs defaultValue="resumen">
              <TabsList className="mb-4">
                <TabsTrigger value="resumen">Resumen</TabsTrigger>
                <TabsTrigger value="tabla">Tabla</TabsTrigger>
                <TabsTrigger value="graficas">Gráficas</TabsTrigger>
              </TabsList>

              <TabsContent value="resumen" className="space-y-4">
                {!rows.length && <p className="text-sm text-slate-600">Sube un CSV para ver el resumen.</p>}
                {!!rows.length && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.entries(summary).map(([k, v]) => (
                      <div key={k} className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="text-xs uppercase tracking-wider text-slate-500">{v.type === 'num' ? 'Numérica' : 'Categórica'}</div>
                        <div className="font-semibold">{k}</div>
                        {v.type === 'num' ? (
                          <div className="text-sm mt-2 grid grid-cols-3 gap-2">
                            <div><span className="text-slate-500">min</span><div>{v.min?.toFixed?.(2) ?? v.min}</div></div>
                            <div><span className="text-slate-500">mediana</span><div>{v.median?.toFixed?.(2) ?? v.median}</div></div>
                            <div><span className="text-slate-500">max</span><div>{v.max?.toFixed?.(2) ?? v.max}</div></div>
                            <div><span className="text-slate-500">q25</span><div>{v.q25?.toFixed?.(2) ?? v.q25}</div></div>
                            <div><span className="text-slate-500">media</span><div>{v.mean?.toFixed?.(2) ?? v.mean}</div></div>
                            <div><span className="text-slate-500">q75</span><div>{v.q75?.toFixed?.(2) ?? v.q75}</div></div>
                          </div>
                        ) : (
                          <div className="text-sm mt-2">
                            <div className="text-slate-500">Top categorías</div>
                            <ul className="list-disc pl-4">
                              {v.top?.map(([cat, c]) => (<li key={String(cat)}>{String(cat)}: {c}</li>))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="tabla">
                {!rows.length ? (
                  <p className="text-sm text-slate-600">No hay datos. Sube un CSV.</p>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm overflow-auto max-h-[540px]">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-slate-100">
                        <tr>
                          {headers.map((h) => (
                            <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 1000).map((r, i) => (
                          <tr key={i} className={classNames(i%2?"bg-slate-50":"bg-white")}>
                            {headers.map((h) => (
                              <td key={h} className="px-3 py-1 whitespace-nowrap">{String(r[h] ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="graficas" className="space-y-4">
                {!rows.length && <p className="text-sm text-slate-600">Sube un CSV para graficar.</p>}
                {!!rows.length && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-4 gap-3">
                      <div>
                        <Label className="mb-1 block">Tipo</Label>
                        <Select value={chart} onValueChange={setChart}>
                          {({ value, onValueChange }) => (
                            <div>
                              <SelectTrigger><SelectValue placeholder="Elige tipo" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="barras" onChange={onValueChange}>Barras / Histograma</SelectItem>
                                <SelectItem value="linea" onChange={onValueChange}>Línea</SelectItem>
                                <SelectItem value="dispersion" onChange={onValueChange}>Dispersión</SelectItem>
                              </SelectContent>
                            </div>
                          )}
                        </Select>
                      </div>
                      <div>
                        <Label className="mb-1 block">Eje X</Label>
                        <Select value={xCol} onValueChange={setXCol}>
                          {({ value, onValueChange }) => (
                            <div>
                              <SelectTrigger><SelectValue placeholder="Columna X" /></SelectTrigger>
                              <SelectContent>
                                {headers.map(h => (<SelectItem key={h} value={h} onChange={onValueChange}>{h}</SelectItem>))}
                              </SelectContent>
                            </div>
                          )}
                        </Select>
                      </div>
                      <div>
                        <Label className="mb-1 block">Eje Y</Label>
                        <Select value={yCol} onValueChange={setYCol}>
                          {({ value, onValueChange }) => (
                            <div>
                              <SelectTrigger><SelectValue placeholder="Columna Y" /></SelectTrigger>
                              <SelectContent>
                                {headers.map(h => (<SelectItem key={h} value={h} onChange={onValueChange}>{h}</SelectItem>))}
                              </SelectContent>
                            </div>
                          )}
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button variant="outline" onClick={()=>{ setXCol(headers[0]||""); setYCol(numericHeaders[0]||headers[1]||""); }}>
                          <Trash2 className="h-4 w-4 mr-2"/> Reset
                        </Button>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 shadow-sm" style={{height: 420}}>
                      {chart === "barras" && (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barrasData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="key" angle={-20} textAnchor="end" height={60} interval={0}/>
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}

                      {chart === "linea" && (
                        <ResponsiveContainer width="100%" height="100%">
                          <RLineChart data={rows.map(r=>({ x:r[xCol], y:Number(r[yCol]) }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="x" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="y" dot={false} />
                          </RLineChart>
                        </ResponsiveContainer>
                      )}

                      {chart === "dispersion" && (
                        <ResponsiveContainer width="100%" height="100%">
                          <RScatterChart>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="x" name={xCol} type="number" />
                            <YAxis dataKey="y" name={yCol} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter data={scatterData} />
                          </RScatterChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <footer className="mt-8 text-xs text-slate-500">
        <p>Si quieres conectar con el backend Django, sirve ambos en el mismo dominio o usa <code>VITE_API_BASE_URL</code>. Caso contrario, el análisis corre 100% en el navegador.</p>
      </footer>
    </div>
  );
}
