import React, { useState } from 'react';
import { Calendar, TrendingUp, Wallet, ArrowDownCircle, ArrowUpCircle, BarChart3, Plus, FileText, Trash2, Layers, X } from 'lucide-react';

interface FinancialReport {
    report_date: string;
    total_revenue: number;
    total_cogs: number;
    total_operating_expenses: number;
    net_profit: number;
    is_finalized: boolean;
}

interface Expense {
    expense_id: number;
    category: string;
    amount: number;
    description: string;
    date: string;
}

interface IncomeRow {
    client_name: string;
    amount: number;
    date: string;
}


const MOCK_DAILY_FINANCES = {
    revenue: 3020.50,
    expenses: 1270.00,
    balance: 1750.50
};

const MOCK_PERIOD_EXPENSES: Expense[] = [
    { expense_id: 1, category: 'Surowce', amount: 850.00, description: 'Mąka pszenna 500kg, drożdże', date: '2026-07-06' },
    { expense_id: 2, category: 'Media', amount: 300.00, description: 'Faktura za gaz (piece)', date: '2026-07-04' },
    { expense_id: 3, category: 'Logistyka', amount: 120.00, description: 'Paliwo - Trasa Bielsko', date: '2026-07-02' },
];

const MOCK_PERIOD_INCOMES: IncomeRow[] = [
    { client_name: 'Biedronka - Skoczów', amount: 1850.00, date: '2026-07-06' },
    { client_name: 'Społem Ustroń', amount: 780.50, date: '2026-07-05' },
    { client_name: 'Restauracja Pod Jelenie', amount: 390.00, date: '2026-07-03' },
];

const MOCK_REPORTS: FinancialReport[] = [
    { report_date: '2026-07-06', total_revenue: 3020.50, total_cogs: 850.00, total_operating_expenses: 420.00, net_profit: 1750.50, is_finalized: true },
    { report_date: '2026-07-05', total_revenue: 2840.00, total_cogs: 790.00, total_operating_expenses: 310.00, net_profit: 1740.00, is_finalized: true },
    { report_date: '2026-07-04', total_revenue: 3150.00, total_cogs: 900.00, total_operating_expenses: 600.00, net_profit: 1650.00, is_finalized: true },
];

export default function FinancePanel() {
    const [activeTab, setActiveTab] = useState<'finanse' | 'raporty' | 'wydatki'>('finanse');

    const [singleDate, setSingleDate] = useState<string>('2026-07-07');
    const [rangeStart, setRangeStart] = useState<string>('2026-06-30');
    const [rangeEnd, setRangeEnd] = useState<string>('2026-07-07');
    const [monthStart, setMonthStart] = useState<string>('2026-07-01');

    const [expenses, setExpenses] = useState<Expense[]>(MOCK_PERIOD_EXPENSES);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [newExpCategory, setNewExpCategory] = useState('Media');
    const [newExpAmount, setNewExpAmount] = useState('');
    const [newExpDesc, setNewExpDesc] = useState('');
    const [newExpDate, setNewExpDate] = useState('2026-07-07');

    const [reports, setReports] = useState<FinancialReport[]>(MOCK_REPORTS);
    const [selectedReport, setSelectedReport] = useState<FinancialReport | null>(null);

    const handleAddExpense = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(newExpAmount);
        if (isNaN(amt) || amt <= 0) {
            alert('Wprowadź poprawną kwotę kosztu.');
            return;
        }
        const newExpense: Expense = {
            expense_id: Date.now(),
            category: newExpCategory,
            amount: amt,
            description: newExpDesc.trim(),
            date: newExpDate
        };
        setExpenses([newExpense, ...expenses]);
        setIsExpenseModalOpen(false);
        setNewExpAmount('');
        setNewExpDesc('');
    };

    const handleGenerateReport = () => {
        const todayStr = '2026-07-07';
        if (reports.some(r => r.report_date === todayStr)) {
            alert('Raport za dzisiejszy dzień został już wygenerowany.');
            return;
        }
        const currentReport: FinancialReport = {
            report_date: todayStr,
            total_revenue: MOCK_DAILY_FINANCES.revenue,
            total_cogs: 950.00,
            total_operating_expenses: 320.00,
            net_profit: MOCK_DAILY_FINANCES.balance,
            is_finalized: true
        };
        setReports([currentReport, ...reports]);
    };

    const handleDeleteReport = (date: string) => {
        const todayStr = '2026-07-07';
        if (date !== todayStr) {
            alert('Uprawnienia administratora pozwalają na usuwanie wyłącznie raportu z bieżącego dnia roboczego.');
            return;
        }
        if (confirm('Czy na pewno chcesz usunąć dzisiejszy raport finansowy?')) {
            setReports(reports.filter(r => r.report_date !== date));
            if (selectedReport?.report_date === date) setSelectedReport(null);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">Rozliczenia i Finanse</h1>
                    <p className="text-xs text-gray-500 font-medium">Monitoring przychodów, kontrola kosztów operacyjnych oraz bilanse daily.</p>
                </div>

                <div className="flex bg-bakery-inactive p-1 rounded border border-bakery-btnBorder shadow-sm">
                    <button onClick={() => setActiveTab('finanse')} className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${activeTab === 'finanse' ? 'bg-bakery-dark text-white shadow-xs' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}>
                        <div className="flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5" /> Finanse</div>
                    </button>
                    <button onClick={() => setActiveTab('raporty')} className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${activeTab === 'raporty' ? 'bg-bakery-dark text-white shadow-xs' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}>
                        <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Raporty</div>
                    </button>
                    <button onClick={() => setActiveTab('wydatki')} className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${activeTab === 'wydatki' ? 'bg-bakery-dark text-white shadow-xs' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}>
                        <div className="flex items-center gap-2"><Plus className="w-3.5 h-3.5" /> Dodaj wydatki</div>
                    </button>
                </div>
            </div>

            <hr className="border-0 border-t border-bakery-border my-1" />

            {activeTab === 'finanse' && (
                <div className="flex flex-col gap-6 w-full">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 bg-bakery-inactive p-2.5 rounded border border-bakery-btnBorder w-fit shadow-xs">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Podgląd dnia:</span>
                            <input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} className="border border-bakery-btnBorder bg-bakery-rowBg text-xs font-bold p-1 rounded outline-none text-bakery-dark cursor-pointer" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 w-full">
                            <div className="bg-bakery-inactive border border-bakery-btnBorder p-4 rounded shadow-sm flex items-center gap-4">
                                <div className="w-10 h-10 bg-emerald-100 border border-emerald-200 rounded-lg flex items-center justify-center text-emerald-700 shrink-0"><ArrowUpCircle className="w-6 h-6" /></div>
                                <div>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase block tracking-wider">Dzisiejsze Przychody</span>
                                    <p className="text-xl font-black text-blue-950 font-mono m-0">+{MOCK_DAILY_FINANCES.revenue.toFixed(2)} PLN</p>
                                </div>
                            </div>
                            <div className="bg-bakery-inactive border border-bakery-btnBorder p-4 rounded shadow-sm flex items-center gap-4">
                                <div className="w-10 h-10 bg-red-100 border border-red-200 rounded-lg flex items-center justify-center text-red-700 shrink-0"><ArrowDownCircle className="w-6 h-6" /></div>
                                <div>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase block tracking-wider">Dzisiejsze Wydatki</span>
                                    <p className="text-xl font-black text-red-900 font-mono m-0">-{MOCK_DAILY_FINANCES.expenses.toFixed(2)} PLN</p>
                                </div>
                            </div>
                            <div className="bg-bakery-inactive border border-bakery-btnBorder p-4 rounded shadow-sm flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-100 border border-blue-200 rounded-lg flex items-center justify-center text-blue-950 shrink-0"><Wallet className="w-6 h-6" /></div>
                                <div>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase block tracking-wider">Dzisiejszy Bilans</span>
                                    <p className={`text-xl font-black font-mono m-0 ${MOCK_DAILY_FINANCES.balance >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>{MOCK_DAILY_FINANCES.balance.toFixed(2)} PLN</p>
                                </div>
                            </div>
                            <div className="bg-bakery-inactive border border-bakery-btnBorder p-3 rounded shadow-sm flex flex-col justify-center gap-1.5">
                                <span className="text-[9px] font-bold text-gray-500 uppercase block tracking-wider text-center">Udział procentowy wydatków w przychodzie</span>
                                <div className="w-full bg-emerald-700 h-5 rounded overflow-hidden flex shadow-inner border border-bakery-btnBorder relative">
                                    <div className="bg-red-600 h-full transition-all duration-300" style={{ width: `${(MOCK_DAILY_FINANCES.expenses / MOCK_DAILY_FINANCES.revenue) * 100}%` }}></div>
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white font-mono">
                                        {((MOCK_DAILY_FINANCES.expenses / MOCK_DAILY_FINANCES.revenue) * 100).toFixed(0)}% Koszty
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-0 border-t border-bakery-border my-1" />

                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 bg-bakery-inactive p-2.5 rounded border border-bakery-btnBorder w-fit shadow-xs">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Analiza okresu:</span>
                            <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="border border-bakery-btnBorder bg-bakery-rowBg text-xs font-bold p-1 rounded outline-none text-bakery-dark cursor-pointer" />
                            <span className="text-xs text-gray-500 font-bold">do</span>
                            <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="border border-bakery-btnBorder bg-bakery-rowBg text-xs font-bold p-1 rounded outline-none text-bakery-dark cursor-pointer" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                            <div className="flex flex-col gap-3">
                                <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm h-[180px] flex flex-col overflow-hidden">
                                    <div className="p-2 border-b border-bakery-btnBorder text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-bakery-inactive">Wydatki operacyjne z wybranego okresu</div>
                                    <div className="flex-1 overflow-y-auto p-1.5">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <tbody>
                                                {expenses.map((exp) => (
                                                    <tr key={exp.expense_id} className="bg-bakery-rowBg border-b border-bakery-btnBorder">
                                                        <td className="py-2 px-3 font-mono text-gray-500 font-bold">{exp.date}</td>
                                                        <td className="py-2 px-3 font-bold text-bakery-dark">{exp.category}</td>
                                                        <td className="py-2 px-3 text-gray-600 font-medium max-w-[180px] truncate">{exp.description}</td>
                                                        <td className="py-2 px-3 text-right font-mono font-bold text-red-900">-{exp.amount.toFixed(2)} zł</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="bg-bakery-inactive border border-bakery-btnBorder p-3 rounded shadow-sm flex flex-col gap-2">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Porównanie kategorii kosztów w okresie</span>
                                    <div className="flex flex-col gap-1.5 text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-20 font-semibold text-gray-600 truncate">Surowce</span>
                                            <div className="flex-1 bg-bakery-rowBg h-3 rounded overflow-hidden border border-bakery-btnBorder shadow-inner"><div className="bg-red-500 h-full w-[80%] rounded-r"></div></div>
                                            <span className="font-mono font-bold w-16 text-right">850.00 zł</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-20 font-semibold text-gray-600 truncate">Media</span>
                                            <div className="flex-1 bg-bakery-rowBg h-3 rounded overflow-hidden border border-bakery-btnBorder shadow-inner"><div className="bg-amber-600 h-full w-[40%] rounded-r"></div></div>
                                            <span className="font-mono font-bold w-16 text-right">300.00 zł</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm h-[180px] flex flex-col overflow-hidden">
                                    <div className="p-2 border-b border-bakery-btnBorder text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-bakery-inactive">Przychody handlowe ze sprzedaży hurtowej</div>
                                    <div className="flex-1 overflow-y-auto p-1.5">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <tbody>
                                                {MOCK_PERIOD_INCOMES.map((inc, index) => (
                                                    <tr key={index} className="bg-bakery-rowBg border-b border-bakery-btnBorder">
                                                        <td className="py-2 px-3 font-mono text-gray-500 font-bold">{inc.date}</td>
                                                        <td className="py-2 px-3 font-bold text-bakery-dark">{inc.client_name}</td>
                                                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">+{inc.amount.toFixed(2)} zł</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="bg-bakery-inactive border border-bakery-btnBorder p-3 rounded shadow-sm flex flex-col gap-2">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Główni płatnicy w wybranym okresie</span>
                                    <div className="flex flex-col gap-1.5 text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-32 font-semibold text-gray-600 truncate">Biedronka - Skoczów</span>
                                            <div className="flex-1 bg-bakery-rowBg h-3 rounded overflow-hidden border border-bakery-btnBorder shadow-inner"><div className="bg-emerald-600 h-full w-[90%] rounded-r"></div></div>
                                            <span className="font-mono font-bold w-16 text-right">1850.00 zł</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-32 font-semibold text-gray-600 truncate">Społem Ustroń</span>
                                            <div className="flex-1 bg-bakery-rowBg h-3 rounded overflow-hidden border border-bakery-btnBorder shadow-inner"><div className="bg-teal-600 h-full w-[45%] rounded-r"></div></div>
                                            <span className="font-mono font-bold w-16 text-right">780.50 zł</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-bakery-inactive border border-bakery-btnBorder p-4 rounded shadow-sm col-span-1 lg:col-span-2 flex flex-col gap-3">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block text-center">Trend zysku netto na przestrzeni ostatnich dni (Wykres porównawczy)</span>
                                <div className="w-full flex items-end justify-around h-36 bg-bakery-rowBg border border-bakery-btnBorder rounded p-4 pt-8 shadow-inner overflow-hidden">

                                    <div className="flex flex-col items-center gap-1 w-16 group">
                                        <span className="text-[10px] font-bold font-mono text-emerald-800 transition-transform group-hover:scale-105">1650 zł</span>
                                        <div className="bg-emerald-700 w-8 h-16 rounded-t shadow-xs transition-all duration-200 group-hover:bg-emerald-600"></div>
                                        <span className="text-[9px] text-gray-500 font-bold font-mono mt-0.5">04.07</span>
                                    </div>

                                    <div className="flex flex-col items-center gap-1 w-16 group">
                                        <span className="text-[10px] font-bold font-mono text-emerald-800 transition-transform group-hover:scale-105">1740 zł</span>
                                        <div className="bg-emerald-700 w-8 h-[72px] rounded-t shadow-xs transition-all duration-200 group-hover:bg-emerald-600"></div>
                                        <span className="text-[9px] text-gray-500 font-bold font-mono mt-0.5">05.07</span>
                                    </div>

                                    <div className="flex flex-col items-center gap-1 w-16 group">
                                        <span className="text-[10px] font-bold font-mono text-emerald-800 transition-transform group-hover:scale-105">1750 zł</span>
                                        <div className="bg-emerald-700 w-8 h-[76px] rounded-t shadow-xs transition-all duration-200 group-hover:bg-emerald-600"></div>
                                        <span className="text-[9px] text-gray-500 font-bold font-mono mt-0.5">06.07</span>
                                    </div>

                                </div>
                            </div>

                        </div>
                    </div>

                </div>
            )}

            {activeTab === 'raporty' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">

                    <div className="lg:col-span-2 flex flex-col gap-4">
                        <div className="flex gap-2">
                            <button onClick={handleGenerateReport} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded transition shadow-xs">
                                <Plus className="w-4 h-4 text-bakery-accent" /> Zamknij dzień i wygeneruj raport
                            </button>
                        </div>

                        <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm h-[320px] flex flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-2">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-bakery-inactive z-10">
                                        <tr className="border-b border-bakery-btnBorder text-[10px] font-bold text-bakery-dark uppercase tracking-wider">
                                            <th className="py-2 px-3 h-8">Okres (Dzień)</th>
                                            <th className="py-2 px-3 h-8 text-right">Przychód ogólny</th>
                                            <th className="py-2 px-3 h-8 text-right">Zysk Netto</th>
                                            <th className="py-2 px-3 text-center h-8">Status</th>
                                            <th className="py-2 px-3 text-center h-8 w-24">Akcje</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-bakery-btnBorder text-sm">
                                        {reports.map((rep, index) => (
                                            <tr key={index} className="bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder">
                                                <td className="py-2 px-3 font-mono text-xs font-bold text-bakery-dark">{rep.report_date}</td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-blue-950">{rep.total_revenue.toFixed(2)} PLN</td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">{rep.net_profit.toFixed(2)} PLN</td>
                                                <td className="py-2 px-3 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">Zatwierdzony</span>
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    <div className="flex gap-1.5 justify-center">
                                                        <button onClick={() => setSelectedReport(rep)} className="text-bakery-dark hover:text-white p-1 rounded bg-bakery-inactive hover:bg-bakery-dark border border-bakery-btnBorder text-[11px] font-bold transition-all shadow-2xs">
                                                            Otwórz
                                                        </button>
                                                        <button onClick={() => handleDeleteReport(rep.report_date)} className="text-red-700 hover:text-white p-1 rounded bg-red-50 hover:bg-red-700 border border-red-200 text-[11px] font-bold transition-all shadow-2xs">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <span className="text-[10px] text-gray-500 font-semibold italic">* Uwaga: System automatycznie zamknie dzień produkcyjny i sporządzi raport księgowy o godzinie 23:59 na backendzie, jeśli nie zrobiono tego ręcznie.</span>
                    </div>

                    <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm p-4 flex flex-col h-[380px] overflow-hidden">
                        <div className="border-b border-bakery-btnBorder pb-2 shrink-0">
                            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">Karta Wyników Finansowych</h2>
                            <p className="text-[11px] text-gray-500 font-medium">Szczegółowe zestawienie kosztów i marż z bazy danych.</p>
                        </div>

                        <div className="flex-1 overflow-y-auto mt-3 pr-1">
                            {selectedReport ? (
                                <div className="space-y-3.5 text-xs">
                                    <div className="bg-bakery-dark text-white p-2 rounded flex justify-between font-bold font-mono">
                                        <span>Data zestawienia:</span>
                                        <span className="text-bakery-accent">{selectedReport.report_date}</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between py-1 border-b border-bakery-btnBorder">
                                            <span className="text-gray-600 font-semibold">1. Przychody całkowite (`total_revenue`):</span>
                                            <span className="font-bold font-mono text-blue-950">{selectedReport.total_revenue.toFixed(2)} PLN</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-bakery-btnBorder">
                                            <span className="text-gray-600 font-semibold">2. Koszt surowców / COGS (`total_cogs`):</span>
                                            <span className="font-bold font-mono text-red-950">-{selectedReport.total_cogs.toFixed(2)} PLN</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-bakery-btnBorder">
                                            <span className="text-gray-600 font-semibold">3. Koszty stałe / Media (`total_operating_expenses`):</span>
                                            <span className="font-bold font-mono text-red-950">-{selectedReport.total_operating_expenses.toFixed(2)} PLN</span>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t-2 border-dashed border-bakery-btnBorder flex justify-between items-center bg-bakery-rowBg p-2 rounded">
                                        <span className="font-bold text-bakery-dark uppercase tracking-wide text-[11px]">Zysk Netto (`net_profit`):</span>
                                        <span className="text-base font-black text-emerald-800 font-mono">{selectedReport.net_profit.toFixed(2)} PLN</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-28 text-center text-gray-500 text-xs font-semibold italic">
                                    Wybierz raport z tabeli obok i kliknij przycisk „Otwórz”, aby załadować szczegółową strukturę kosztów.
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            )}

            {activeTab === 'wydatki' && (
                <div className="flex flex-col gap-4 w-full">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-bakery-inactive p-3 rounded border border-bakery-btnBorder shadow-sm w-full">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Okres zestawienia kosztów:</span>
                            <input type="date" value={monthStart} onChange={(e) => setMonthStart(e.target.value)} className="border border-bakery-btnBorder bg-bakery-rowBg text-xs font-bold p-1 rounded outline-none text-bakery-dark cursor-pointer" />
                            <span className="text-xs text-gray-500 font-bold">do dzisiaj</span>
                        </div>

                        <button onClick={() => setIsExpenseModalOpen(true)} className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded transition shadow-xs active:scale-[0.98]">
                            <Plus className="w-4 h-4 text-bakery-accent" /> Zarejestruj nowy wydatek
                        </button>
                    </div>

                    <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm overflow-hidden w-full">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-bakery-btnBorder text-[10px] font-bold text-bakery-dark uppercase tracking-wider bg-bakery-inactive">
                                    <th className="py-3 px-4 w-32">Data kosztu</th>
                                    <th className="py-3 px-4 w-44">Kategoria kosztowa</th>
                                    <th className="py-3 px-4">Opis dokumentu / faktury</th>
                                    <th className="py-3 px-4 text-right w-44">Wartość brutto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-bakery-btnBorder text-sm">
                                {expenses.map((exp) => (
                                    <tr key={exp.expense_id} className="bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder">
                                        <td className="py-2.5 px-4 font-mono font-bold text-xs text-bakery-dark">{exp.date}</td>
                                        <td className="py-2.5 px-4">
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${exp.category === 'Surowce' ? 'bg-amber-100 text-amber-700 border border-amber-200' : exp.category === 'Media' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-300 text-gray-700'}`}>
                                                {exp.category}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-4 text-xs font-semibold text-gray-700">{exp.description}</td>
                                        <td className="py-2.5 px-4 text-right font-mono font-bold text-red-900">-{exp.amount.toFixed(2)} PLN</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isExpenseModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
                    <form onSubmit={handleAddExpense} className="bg-bakery-inactive border border-bakery-border rounded shadow-xl w-full max-w-md overflow-hidden flex flex-col">

                        <div className="bg-bakery-dark text-white p-4 flex justify-between items-center">
                            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <Wallet className="w-4 h-4 text-bakery-accent" /> Zapis dokumentu kosztowego
                            </h2>
                            <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="text-gray-400 hover:text-white transition"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-5 flex flex-col gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Kategoria kosztu</label>
                                <select value={newExpCategory} onChange={(e) => setNewExpCategory(e.target.value)} className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none">
                                    <option value="Media">Media (Prąd, Gaz, Woda)</option>
                                    <option value="Surowce">Surowce (Zatowarowanie piekarni)</option>
                                    <option value="Logistyka">Logistyka (Paliwo, Amortyzacja aut)</option>
                                    <option value="Inne">Inne koszty eksploatacyjne</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Kwota kosztu (PLN)</label>
                                    <input type="number" step="0.01" min="0.01" required value={newExpAmount} onChange={(e) => setNewExpAmount(e.target.value)} placeholder="0.00" className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-bold font-mono rounded text-xs p-2 outline-none focus:border-bakery-accent" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Data księgowania</label>
                                    <input type="date" required value={newExpDate} onChange={(e) => setNewExpDate(e.target.value)} className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-bold rounded text-xs p-2 outline-none cursor-pointer focus:border-bakery-accent" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Opis transakcji / Uwagi</label>
                                <textarea required rows={3} value={newExpDesc} onChange={(e) => setNewExpDesc(e.target.value)} placeholder="np. Faktura VAT nr 123/2026 - energia elektryczna piece" className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent resize-none" />
                            </div>
                        </div>

                        <div className="bg-bakery-rowBg p-3 border-t border-bakery-btnBorder flex justify-end gap-2">
                            <button type="submit" className="px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded shadow-xs transition">
                                Zaksięguj Wydatek
                            </button>
                            <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="px-4 py-2 text-xs font-bold bg-bakery-inactive border border-bakery-btnBorder text-bakery-dark rounded transition">
                                Anuluj
                            </button>
                        </div>

                    </form>
                </div>
            )}

        </div>
    );
}