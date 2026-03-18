import { useState, useCallback, useRef } from 'react';
import { useTrips } from '../hooks/useTrips';
import { createTrip, deleteTrip, toggleTripMap, searchAirports, searchStations, importTripsFromExcel, getTemplateDownloadUrl } from '../services/tripService';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Plane, Train, Ship, Bus, Car, MoreHorizontal, Eye, EyeOff, X, Navigation, Download, FileSpreadsheet } from 'lucide-react';
import type { TransportType, Airport, Station } from '../types';

const transportIcons: Record<TransportType, typeof Plane> = {
  flight: Plane,
  train: Train,
  ship: Ship,
  bus: Bus,
  drive: Car,
  other: MoreHorizontal,
};

const transportLabels: Record<TransportType, string> = {
  flight: '飞机',
  train: '火车',
  ship: '轮船',
  bus: '大巴',
  drive: '自驾',
  other: '其他',
};

interface LocationSuggestion {
  name: string;
  lat: number;
  lng: number;
  label: string;
}

function useLocationSearch(type: 'flight' | 'train' | 'other') {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (query: string) => {
      if (!query || query.length < 1) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        if (type === 'flight') {
          const airports = await searchAirports(query);
          setSuggestions(
            airports.map((a: Airport) => ({
              name: `${a.city} ${a.name}`,
              lat: a.lat,
              lng: a.lng,
              label: `${a.iata} - ${a.city} ${a.name}, ${a.country}`,
            })),
          );
        } else if (type === 'train') {
          const stations = await searchStations(query);
          setSuggestions(
            stations.map((s: Station) => ({
              name: `${s.name}站`,
              lat: s.lat,
              lng: s.lng,
              label: `${s.name} (${s.code})`,
            })),
          );
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [type],
  );

  return { suggestions, loading, search, clear: () => setSuggestions([]) };
}

interface TripFormData {
  tripDate: string;
  transportType: TransportType;
  carrier: string;
  tripNumber: string;
  originName: string;
  originLat: string;
  originLng: string;
  destName: string;
  destLat: string;
  destLng: string;
  notes: string;
  showOnMap: boolean;
}

const emptyForm: TripFormData = {
  tripDate: new Date().toISOString().split('T')[0],
  transportType: 'flight',
  carrier: '',
  tripNumber: '',
  originName: '',
  originLat: '',
  originLng: '',
  destName: '',
  destLat: '',
  destLng: '',
  notes: '',
  showOnMap: false,
};

export default function TripsPage() {
  const { data: trips, isLoading } = useTrips();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TripFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const originSearch = useLocationSearch(form.transportType === 'flight' ? 'flight' : form.transportType === 'train' ? 'train' : 'other');
  const destSearch = useLocationSearch(form.transportType === 'flight' ? 'flight' : form.transportType === 'train' ? 'train' : 'other');

  const handleSubmit = async () => {
    if (!form.originName || !form.destName || !form.originLat || !form.originLng || !form.destLat || !form.destLng) return;
    const oLat = parseFloat(form.originLat);
    const oLng = parseFloat(form.originLng);
    const dLat = parseFloat(form.destLat);
    const dLng = parseFloat(form.destLng);
    if ([oLat, oLng, dLat, dLng].some(Number.isNaN)) return;
    setSubmitting(true);
    try {
      await createTrip({
        tripDate: form.tripDate,
        transportType: form.transportType,
        carrier: form.carrier,
        tripNumber: form.tripNumber,
        originName: form.originName,
        originLat: oLat,
        originLng: oLng,
        destName: form.destName,
        destLat: dLat,
        destLng: dLng,
        notes: form.notes,
        showOnMap: form.showOnMap,
      });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['tripMap'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
      setForm(emptyForm);
      setShowForm(false);
    } catch (e) {
      console.error('Failed to create trip:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条行程吗？')) return;
    await deleteTrip(id);
    queryClient.invalidateQueries({ queryKey: ['trips'] });
    queryClient.invalidateQueries({ queryKey: ['tripMap'] });
    queryClient.invalidateQueries({ queryKey: ['userStats'] });
  };

  const handleToggleMap = async (id: string) => {
    await toggleTripMap(id);
    queryClient.invalidateQueries({ queryKey: ['trips'] });
    queryClient.invalidateQueries({ queryKey: ['tripMap'] });
  };

  const selectOrigin = (s: LocationSuggestion) => {
    setForm((f) => ({ ...f, originName: s.name, originLat: String(s.lat), originLng: String(s.lng) }));
    originSearch.clear();
  };

  const selectDest = (s: LocationSuggestion) => {
    setForm((f) => ({ ...f, destName: s.name, destLat: String(s.lat), destLng: String(s.lng) }));
    destSearch.clear();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importTripsFromExcel(file);
      setImportResult({ imported: result.imported, errors: result.errors });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['tripMap'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
    } catch {
      setImportResult({ imported: 0, errors: ['上传失败，请检查文件格式'] });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">旅行足迹</h1>
          <p className="text-sm text-gray-500 mt-1">记录你的每一段旅程</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? '取消' : '添加行程'}
        </button>
      </div>

      {/* Batch import bar */}
      <div className="flex items-center gap-2 mb-6">
        <a
          href={getTemplateDownloadUrl()}
          download
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors no-underline"
        >
          <Download className="w-3.5 h-3.5" />
          下载模板
        </a>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors disabled:opacity-50"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          {importing ? '导入中...' : '批量导入'}
        </button>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`rounded-lg p-3 mb-4 text-sm ${importResult.imported > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {importResult.imported > 0 && <p>成功导入 {importResult.imported} 条行程</p>}
          {importResult.errors.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {importResult.errors.map((err, i) => (
                <p key={i} className="text-xs">{err}</p>
              ))}
            </div>
          )}
          <button onClick={() => setImportResult(null)} className="text-xs underline mt-1 opacity-70">关闭</button>
        </div>
      )}

      {/* New Trip Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">新增行程</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">出行日期</label>
              <input
                type="date"
                value={form.tripDate}
                onChange={(e) => setForm((f) => ({ ...f, tripDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">交通方式</label>
              <select
                value={form.transportType}
                onChange={(e) => setForm((f) => ({ ...f, transportType: e.target.value as TransportType }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {Object.entries(transportLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">航司/铁路公司</label>
              <input
                value={form.carrier}
                onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))}
                placeholder="如：东方航空"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">航班号/车次</label>
              <input
                value={form.tripNumber}
                onChange={(e) => setForm((f) => ({ ...f, tripNumber: e.target.value }))}
                placeholder="如：MU5101 / G7506"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            {/* Origin with autocomplete */}
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1">出发地</label>
              <input
                value={form.originName}
                onChange={(e) => {
                  setForm((f) => ({ ...f, originName: e.target.value, originLat: '', originLng: '' }));
                  originSearch.search(e.target.value);
                }}
                placeholder={form.transportType === 'flight' ? '搜索机场...' : form.transportType === 'train' ? '搜索车站...' : '输入地名'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {originSearch.suggestions.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {originSearch.suggestions.map((s, i) => (
                    <button key={i} onClick={() => selectOrigin(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 truncate">
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Destination with autocomplete */}
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1">到达地</label>
              <input
                value={form.destName}
                onChange={(e) => {
                  setForm((f) => ({ ...f, destName: e.target.value, destLat: '', destLng: '' }));
                  destSearch.search(e.target.value);
                }}
                placeholder={form.transportType === 'flight' ? '搜索机场...' : form.transportType === 'train' ? '搜索车站...' : '输入地名'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {destSearch.suggestions.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {destSearch.suggestions.map((s, i) => (
                    <button key={i} onClick={() => selectDest(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 truncate">
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">备注</label>
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="如：出差、旅游、探亲..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.showOnMap}
                onChange={(e) => setForm((f) => ({ ...f, showOnMap: e.target.checked }))}
                className="rounded"
              />
              在地图上显示
            </label>
            <button
              onClick={handleSubmit}
              disabled={submitting || !form.originName || !form.destName || !form.originLat || !form.originLng || !form.destLat || !form.destLng}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? '保存中...' : '保存行程'}
            </button>
          </div>
        </div>
      )}

      {/* Trip List */}
      {(!trips || trips.length === 0) ? (
        <div className="text-center py-16 text-gray-400">
          <Navigation className="w-12 h-12 mx-auto mb-3" />
          <p className="text-lg">还没有行程记录</p>
          <p className="text-sm mt-1">点击"添加行程"开始记录你的旅途</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => {
            const Icon = transportIcons[trip.transportType] || MoreHorizontal;
            return (
              <div
                key={trip.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow"
              >
                {/* Transport Icon */}
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-900 truncate">{trip.originName}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-gray-900 truncate">{trip.destName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span>{new Date(trip.tripDate).toLocaleDateString('zh-CN')}</span>
                    {trip.tripNumber && <span className="font-mono">{trip.tripNumber}</span>}
                    {trip.carrier && <span>{trip.carrier}</span>}
                    {trip.notes && <span className="truncate">{trip.notes}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleMap(trip.id)}
                    title={trip.showOnMap ? '从地图移除' : '显示在地图'}
                    className={`p-2 rounded-lg transition-colors ${
                      trip.showOnMap ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {trip.showOnMap ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(trip.id)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
