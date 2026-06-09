import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { HomeDashboard } from '../features/dashboard/pages/HomeDashboard';


const OrdersPage = () => <div className="page-card"><h2>Moduł Zamówień</h2><p>Zarządzanie zamówieniami codziennymi i stałymi.</p></div>;
const WarehousePage = () => <div className="page-card"><h2>Magazyn i Surowce</h2><p>Stany magazynowe składników i dostawy.</p></div>;
const LogisticsPage = () => <div className="page-card"><h2>Logistyka i Trasy</h2><p>Planowanie tras dla kierowców.</p></div>;
const RecipesPage = () => <div className="page-card"><h2>Receptury i Produkty</h2><p>Zarządzanie składem produktów i pieczywa.</p></div>;
const FinancePage = () => <div className="page-card"><h2>Finanse i Wydatki</h2><p>Analiza kosztów, przychodów i raporty COGS.</p></div>;
const UsersPage = () => <div className="page-card"><h2>Użytkownicy i Pracownicy</h2><p>Zarządzanie kontami adminów, piekarzy i kierowców.</p></div>;
const ClientsPage = () => <div className="page-card"><h2>Baza Klientów</h2><p>Lista odbiorców (sklepy, punkty sprzedaży).</p></div>;
const ContractorsPage = () => <div className="page-card"><h2>Kontrahenci / Dostawcy</h2><p>Hurtownie mąki, drożdży itp.</p></div>;

const NotFoundPage = () => <div className="page-card"><h2>⚠️ Błąd 404</h2><p>Nie ma takiej strony.</p></div>;

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        
        <Route index element={<HomeDashboard />} />
        
        <Route path="orders" element={<OrdersPage />} />
        <Route path="warehouse" element={<WarehousePage />} />
        <Route path="logistics" element={<LogisticsPage />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="contractors" element={<ContractorsPage />} />
        
      </Route>
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
};