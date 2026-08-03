import React, { useState } from 'react';
import { Upload, FileText, Download, Table as TableIcon, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import axios from 'axios';

const SwitchgearDatasheetGenerator = () => {
  const [file, setFile] = useState(null);
  const [projectInfo, setProjectInfo] = useState({
    project_name: '',
    drawing_number: '',
    area: ''
  });
  const [loading, setLoading] = useState(false);
  const [datasheetRows, setDatasheetRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please upload a PDF file');
      setFile(null);
    }
  };

  const handleGenerate = async () => {
    if (!file) {
      setError('Please upload an SLD PDF file');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('sld_file', file);
    formData.append('project_name', projectInfo.project_name);
    formData.append('drawing_number', projectInfo.drawing_number);
    formData.append('area', projectInfo.area);

    try {
      const response = await axios.post(
        '/api/v1/electrical-datasheet/datasheets/generate-switchgear-datasheet/',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        setDatasheetRows(response.data.datasheet_rows);
        setSummary(response.data.summary);
      } else {
        setError(response.data.error || 'Failed to generate datasheet');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred while generating datasheet');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const response = await axios.post(
        '/api/v1/electrical-datasheet/datasheets/export-switchgear-datasheet/',
        {
          datasheet_rows: datasheetRows,
          project_info: projectInfo
        },
        {
          responseType: 'blob',
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `11KV_Switchgear_Datasheet_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to download Excel file');
      console.error('Download error:', err);
    }
  };

  const renderDatasheetTable = () => {
    if (!datasheetRows.length) return null;

    return (
      <div className="mt-8 bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TableIcon className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">11KV Switchgear Datasheet Preview</h2>
          </div>
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 bg-white text-purple-600 px-4 py-2 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
          >
            <Download className="w-5 h-5" />
            Download Excel
          </button>
        </div>

        {summary && (
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="grid grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <div className="text-sm text-gray-600">Total Rows</div>
                  <div className="text-lg font-bold text-gray-900">{summary.total_rows}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="text-sm text-gray-600">Equipment Count</div>
                  <div className="text-lg font-bold text-gray-900">{summary.equipment_count}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <div className="text-sm text-gray-600">Completed Fields</div>
                  <div className="text-lg font-bold text-green-600">{summary.completed_fields}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <div>
                  <div className="text-sm text-gray-600">Missing Fields</div>
                  <div className="text-lg font-bold text-orange-600">{summary.missing_fields}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold w-20">SR NO</th>
                <th className="px-4 py-3 text-left text-sm font-semibold w-1/3">DESCRIPTION</th>
                <th className="px-4 py-3 text-left text-sm font-semibold w-1/4">REQUIRED DATA</th>
                <th className="px-4 py-3 text-left text-sm font-semibold w-1/4">VENDOR DATA</th>
                <th className="px-4 py-3 text-left text-sm font-semibold w-24">Rem</th>
              </tr>
            </thead>
            <tbody>
              {datasheetRows.map((row, index) => {
                const isSectionHeader = !row.sr_no && row.description && !row.required_data && !row.vendor_data;
                
                return (
                  <tr
                    key={index}
                    className={`
                      ${isSectionHeader ? 'bg-blue-50 font-bold' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      hover:bg-blue-100 transition-colors border-b border-gray-200
                    `}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">{row.sr_no}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.required_data}</td>
                    <td className={`px-4 py-3 text-sm ${row.vendor_data ? 'text-green-700 font-medium' : 'text-gray-400'}`}>
                      {row.vendor_data || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.remarks}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-3 rounded-lg">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">11KV Switchgear Datasheet Generator</h1>
              <p className="text-gray-600 mt-1">Upload SLD PDF to automatically generate comprehensive equipment datasheet</p>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Upload SLD Document</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
              <input
                type="text"
                value={projectInfo.project_name}
                onChange={(e) => setProjectInfo({...projectInfo, project_name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter project name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Drawing Number</label>
              <input
                type="text"
                value={projectInfo.drawing_number}
                onChange={(e) => setProjectInfo({...projectInfo, drawing_number: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter drawing number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Area/Location</label>
              <input
                type="text"
                value={projectInfo.area}
                onChange={(e) => setProjectInfo({...projectInfo, area: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter area"
              />
            </div>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-500 transition-colors">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                {file ? file.name : 'Click to upload SLD PDF'}
              </p>
              <p className="text-sm text-gray-500">
                Upload 11KV Switchgear Single Line Diagram
              </p>
            </label>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!file || loading}
            className={`mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all ${
              !file || loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl'
            }`}
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Generating Datasheet...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Generate Datasheet
              </>
            )}
          </button>
        </div>

        {/* Datasheet Preview */}
        {renderDatasheetTable()}
      </div>
    </div>
  );
};

export default SwitchgearDatasheetGenerator;
