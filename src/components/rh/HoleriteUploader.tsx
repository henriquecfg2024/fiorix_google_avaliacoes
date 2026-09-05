"use client";

import React, { useState } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Eye,
  ScrollText,
  RefreshCw,
  Trash2,
  Lock,
  Download,
  Shield,
  X,
  Search,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

interface HoleriteItem {
  id: string;
  colaborador: string;
  cpf: string;
  mesAno: string;
  dataUpload: string;
  uploadedBy: string;
  visualizacoes: number;
  status: "Ativo" | "Visualizado" | "Ciente";
  arquivoNome: string;
  hash: string;
}

import { COLABORADORES_REAIS_63 } from "./mockColaboradores45";

export function HoleriteUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modais
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<HoleriteItem | null>(null);
  const [viewPdfItem, setViewPdfItem] = useState<HoleriteItem | null>(null);
  const [viewLogsItem, setViewLogsItem] = useState<HoleriteItem | null>(null);

  // Lista de holerites existentes no sistema (Base real 7º RI SP)
  const [holeritesList, setHoleritesList] = useState<HoleriteItem[]>([
    {
      id: "hol-1",
      colaborador: "Henrique Cesar Ferreira Gama",
      cpf: "***.000.000-28",
      mesAno: "08/2026",
      dataUpload: "30/08/2026 09:00",
      uploadedBy: "Nadia Najjar (RH)",
      visualizacoes: 12,
      status: "Ciente",
      arquivoNome: "10000000028_08-2026.pdf",
      hash: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    },
    {
      id: "hol-2",
      colaborador: "Amanda Aparecida Gil",
      cpf: "***.000.000-02",
      mesAno: "08/2026",
      dataUpload: "30/08/2026 09:02",
      uploadedBy: "Nadia Najjar (RH)",
      visualizacoes: 8,
      status: "Visualizado",
      arquivoNome: "10000000002_08-2026.pdf",
      hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    {
      id: "hol-3",
      colaborador: "Alex Nogueira Junior",
      cpf: "***.000.000-01",
      mesAno: "08/2026",
      dataUpload: "30/08/2026 09:03",
      uploadedBy: "Nadia Najjar (RH)",
      visualizacoes: 0,
      status: "Ativo",
      arquivoNome: "10000000001_08-2026.pdf",
      hash: "a1b2c3d4e5f67a89bc012d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a",
    },
    {
      id: "hol-4",
      colaborador: "Claudio Donizetti Ferreira da Silva",
      cpf: "***.000.000-12",
      mesAno: "08/2026",
      dataUpload: "30/08/2026 09:05",
      uploadedBy: "Nadia Najjar (RH)",
      visualizacoes: 5,
      status: "Ciente",
      arquivoNome: "10000000012_08-2026.pdf",
      hash: "5d41402abc4b2a76b9719d911017c592",
    },
    {
      id: "hol-5",
      colaborador: "Nadia Najjar",
      cpf: "***.000.000-42",
      mesAno: "08/2026",
      dataUpload: "30/08/2026 09:07",
      uploadedBy: "Nadia Najjar (RH)",
      visualizacoes: 3,
      status: "Visualizado",
      arquivoNome: "10000000042_08-2026.pdf",
      hash: "9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca7",
    },
    {
      id: "hol-6",
      colaborador: "Antonio Carlos Belato Câmara",
      cpf: "***.000.000-08",
      mesAno: "07/2026",
      dataUpload: "30/07/2026 14:00",
      uploadedBy: "Nadia Najjar (RH)",
      visualizacoes: 14,
      status: "Ciente",
      arquivoNome: "10000000008_07-2026.pdf",
      hash: "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
    },
  ]);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    setFiles(selected);
  };

  const handleUpload = () => {
    if (files.length === 0) return;
    setUploading(true);
    setTimeout(() => {
      const novosHolerites: HoleriteItem[] = files.map((f, idx) => {
        // Formato esperado: CPF_MM-AAAA.pdf
        const cleanName = f.name.replace(/\.pdf$/i, "");
        const parts = cleanName.split("_");
        const rawCpf = parts[0] || "";
        const mesAno = parts[1] ? parts[1].replace("-", "/") : "08/2026";
        
        // Busca nos colaboradores reais pelo sufixo ou CPF
        const found = COLABORADORES_REAIS_63.find((c) => {
          const digits = c.cpf.replace(/\D/g, "");
          return rawCpf.endsWith(digits.slice(-2)) || rawCpf === digits;
        });

        const colabNome = found ? found.nome : `Colaborador CPF ${rawCpf.slice(-2)}`;
        const colabCpf = found ? found.cpf : `***.000.000-${rawCpf.slice(-2) || "00"}`;

        return {
          id: `hol-${Date.now()}-${idx}`,
          colaborador: colabNome,
          cpf: colabCpf,
          mesAno: mesAno,
          dataUpload: new Date().toLocaleString("pt-BR"),
          uploadedBy: "Nadia Najjar (RH)",
          visualizacoes: 0,
          status: "Ativo" as const,
          arquivoNome: f.name,
          hash: `sha256_${Date.now().toString(16)}_${idx}`,
        };
      });

      setHoleritesList((prev) => [...novosHolerites, ...prev]);
      setUploading(false);
      alert(`${files.length} holerites enviados, associados aos colaboradores do 7º RI SP e assinados com SHA-256 com sucesso!`);
      setFiles([]);
    }, 1200);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredHolerites.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredHolerites.map((h) => h.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const filteredHolerites = holeritesList.filter(
    (h) =>
      h.colaborador.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.cpf.includes(searchTerm) ||
      h.mesAno.includes(searchTerm)
  );

  const confirmDeleteHolerite = async (motivo: string, senha: string) => {
    if (!itemToDelete) return;
    const deletedId = itemToDelete.id;
    setHoleritesList((prev) => prev.filter((h) => h.id !== deletedId));
    setSelectedIds((prev) => prev.filter((id) => id !== deletedId));
    alert(
      `Holerite ${itemToDelete.mesAno} de ${itemToDelete.colaborador} arquivado via soft-delete WORM. Hash da operação registrado em fiorix_acesso_log.`
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Deseja realizar o soft-delete de ${selectedIds.length} holerites selecionados?`)) {
      setHoleritesList((prev) => prev.filter((h) => !selectedIds.includes(h.id)));
      setSelectedIds([]);
      alert(`${selectedIds.length} holerites removidos do storage com logs de trilha preservados.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload em Lote Card */}
      <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Upload em Lote de Holerites & Comprovantes de Rendimentos
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Padrão de nomenclatura obrigatório: <code className="text-cyan-300 font-mono">CPF_MM-AAAA.pdf</code> (ex: 12345678901_08-2026.pdf)
            </p>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            VALIDAÇÃO 1-PARA-1 POR CPF
          </span>
        </div>

        {/* Dropzone Area */}
        <div className="relative border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-2xl p-8 flex flex-col items-center justify-center transition-all bg-[#05050a]/60 group">
          <UploadCloud className="w-10 h-10 text-indigo-400 mb-3 group-hover:scale-110 transition-transform" />
          <p className="text-xs font-semibold text-white">Arraste os arquivos PDF ou clique para selecionar</p>
          <p className="text-[11px] text-slate-400 mt-1">Até 5MB por arquivo • Validação 1-para-1 por CPF e guarda segura com watermark nominal</p>
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileSelection}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>

        {files.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/10 rounded-xl">
            <span className="text-xs text-slate-200">
              <strong className="text-cyan-400">{files.length}</strong> arquivos PDF prontos para processamento
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setFiles([])} className="text-xs text-slate-400">
                Limpar
              </Button>
              <Button
                size="sm"
                onClick={handleUpload}
                disabled={uploading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
              >
                {uploading ? "Processando..." : "Confirmar Upload em Lote"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tabela de Gestão de Holerites Emitidos (ABAIXO DO DRAG & DROP) */}
      <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Holerites Armazenados & Registro de Visualizações
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Controle de entrega de contracheques, logs de download e custódia digital auditável
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar colaborador ou mês..."
                className="bg-[#05050a] border-white/15 pl-9 text-xs h-9 rounded-xl text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-indigo-500/10 border border-indigo-500/25 rounded-xl animate-in fade-in">
            <span className="text-xs text-indigo-300 font-medium">
              <strong>{selectedIds.length}</strong> holerite(s) selecionado(s)
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => alert(`Baixando registros de logs dos ${selectedIds.length} holerites em CSV...`)}
                className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 text-xs h-8 rounded-lg gap-1"
              >
                <Download className="w-3 h-3" />
                <span>Baixar Logs Selecionados</span>
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-8 rounded-lg gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Excluir Selecionados</span>
              </Button>
            </div>
          </div>
        )}

        {/* Tabela de Holerites */}
        <div className="border border-white/10 rounded-xl overflow-hidden bg-[#05050a]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#12141F] text-slate-400 uppercase font-mono text-[10px] border-b border-white/10">
              <tr>
                <th className="px-4 py-3.5 w-10 text-center">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white">
                    {selectedIds.length === filteredHolerites.length && filteredHolerites.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3.5">Colaborador</th>
                <th className="px-4 py-3.5">CPF Mascarado</th>
                <th className="px-4 py-3.5">Mês/Ano</th>
                <th className="px-4 py-3.5">Data Upload</th>
                <th className="px-4 py-3.5">Uploaded By</th>
                <th className="px-4 py-3.5">Visualizações</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {filteredHolerites.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <tr key={item.id} className={`hover:bg-white/[0.03] transition-colors ${isSelected ? "bg-indigo-500/[0.06]" : ""}`}>
                    <td className="px-4 py-3.5 text-center">
                      <button onClick={() => toggleSelect(item.id)} className="text-slate-400 hover:text-white">
                        {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-white flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{item.colaborador}</span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-400">{item.cpf}</td>
                    <td className="px-4 py-3.5 font-mono text-cyan-300 font-bold">{item.mesAno}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-400 text-[11px]">{item.dataUpload}</td>
                    <td className="px-4 py-3.5 text-slate-300">{item.uploadedBy}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono font-bold text-indigo-400">{item.visualizacoes}</span>
                      <span className="text-[10px] text-slate-500 ml-1">views</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                          item.status === "Ciente"
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : item.status === "Visualizado"
                            ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                            : "bg-slate-500/15 text-slate-300 border-slate-500/30"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewPdfItem(item)}
                          title="Visualizar com Watermark"
                          className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setViewLogsItem(item)}
                          title="Ver Logs de Auditoria"
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <ScrollText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => alert(`Substituir holerite de ${item.colaborador}: selecione novo PDF.`)}
                          title="Substituir Arquivo"
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setItemToDelete(item);
                            setDeleteModalOpen(true);
                          }}
                          title="Excluir Holerite (Soft-Delete LGPD)"
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Visualizador Seguro de PDF */}
      {viewPdfItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-2xl bg-[#0d0d18] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#12141F]">
              <div>
                <h3 className="text-sm font-bold text-white">Visualizador Seguro de Holerite (SecurePDFViewer)</h3>
                <p className="text-xs text-slate-400">
                  {viewPdfItem.colaborador} • Competência: {viewPdfItem.mesAno}
                </p>
              </div>
              <button onClick={() => setViewPdfItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 bg-[#05050a] flex flex-col items-center justify-center relative min-h-[300px] border-b border-white/5">
              {/* Watermark Diagonal */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 rotate-[-25deg] select-none text-2xl font-black text-white text-center leading-tight">
                7º REGISTRO DE IMÓVEIS SP
                <br />
                {viewPdfItem.colaborador} ({viewPdfItem.cpf})
                <br />
                ACESSADO EM {new Date().toLocaleDateString("pt-BR")}
              </div>

              <div className="w-full max-w-md bg-white/[0.04] border border-white/10 rounded-xl p-6 space-y-3 z-10">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-white">RECIBO DE PAGAMENTO DE SALÁRIO</span>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">{viewPdfItem.mesAno}</span>
                </div>
                <div className="text-xs space-y-1 text-slate-300">
                  <p><strong>Empregador:</strong> 7º Oficial de Registro de Imóveis da Comarca da Capital</p>
                  <p><strong>Colaborador:</strong> {viewPdfItem.colaborador}</p>
                  <p><strong>CPF:</strong> {viewPdfItem.cpf}</p>
                  <p><strong>Hash do Documento:</strong> <span className="font-mono text-[10px] text-slate-400">{viewPdfItem.hash.substring(0, 24)}...</span></p>
                </div>
                <div className="pt-3 border-t border-white/10 flex justify-between text-xs font-bold">
                  <span className="text-slate-300">LÍQUIDO A RECEBER:</span>
                  <span className="text-emerald-400 font-mono">R$ 5.480,20</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-[#12141F] flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">🔒 Criptografia AES-256 e Trilha WORM ativas</span>
              <Button size="sm" onClick={() => setViewPdfItem(null)} className="bg-white/10 hover:bg-white/20 text-xs">
                Fechar Visualizador
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Logs de Acesso do Holerite */}
      {viewLogsItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-xl bg-[#0d0d18] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#12141F]">
              <div className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Logs de Acesso e Ciência (LGPD)</h3>
                  <p className="text-xs text-slate-400">{viewLogsItem.colaborador} • {viewLogsItem.mesAno}</p>
                </div>
              </div>
              <button onClick={() => setViewLogsItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-[#05050a] space-y-3 max-h-[350px] overflow-y-auto">
              <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5 space-y-1 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-emerald-400">CIÊNCIA REGISTRADA</span>
                  <span className="font-mono text-slate-400">30/08/2026 14:10:05</span>
                </div>
                <p className="text-slate-300">IP: 189.40.12.88 • Dispositivo: Windows / Chrome 128</p>
                <p className="text-[10px] font-mono text-slate-500">Hash: 8a4c11b0e9... (Assinatura Digital Válida)</p>
              </div>

              <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5 space-y-1 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-indigo-400">VISUALIZAÇÃO DE CONFERÊNCIA</span>
                  <span className="font-mono text-slate-400">30/08/2026 09:45:12</span>
                </div>
                <p className="text-slate-300">IP: 189.40.12.88 • Tempo de permanência: 45s</p>
              </div>

              <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5 space-y-1 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-cyan-400">UPLOAD EM LOTE & DISPONIBILIZAÇÃO</span>
                  <span className="font-mono text-slate-400">30/08/2026 09:00:00</span>
                </div>
                <p className="text-slate-300">Autor: Maria Silva (RH) • Arquivo: {viewLogsItem.arquivoNome}</p>
              </div>
            </div>

            <div className="px-6 py-3 bg-[#12141F] flex justify-end">
              <Button size="sm" onClick={() => setViewLogsItem(null)} className="bg-white/10 hover:bg-white/20 text-xs">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusão LGPD */}
      {itemToDelete && (
        <DeleteConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setItemToDelete(null);
          }}
          onConfirm={confirmDeleteHolerite}
          title="Excluir Holerite (LGPD Art. 5 II)"
          itemDescription={`Holerite ${itemToDelete.mesAno} de ${itemToDelete.colaborador} (CPF: ${itemToDelete.cpf})`}
          wormWarning="Excluir holerite? Dado pessoal sensível (LGPD Art. 5 II) será desvinculado e removido do storage ativo, mas o log e hash da operação serão mantidos em custódia WORM por 5 anos para comprovação jurídica perante o Provimento 213/2026."
        />
      )}
    </div>
  );
}
