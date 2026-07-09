import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { HomeDashboard } from '../features/dashboard/pages/HomeDashboard';

import ZamowieniaPanel from '../features/dashboard/pages/Orders';
import Produkty from '../features/dashboard/pages/Products';
import Finance from '../features/dashboard/pages/Finance';
import Users from '../features/dashboard/pages/Users';
import Clients from '../features/dashboard/pages/Clients';
import Contractors from '../features/dashboard/pages/Contractors';
import Warehouse from '../features/dashboard/pages/Warehouse';
import Logistics from '../features/dashboard/pages/Logistics';
import Notifications from '../features/dashboard/pages/Notifications';

import { Login } from '../features/dashboard/pages/Login';
import { getAuthToken } from '../services/api';

const NotFoundPage = () => <div className="page-card"><h2>Błąd 404</h2><p>Nie ma takiej strony.</p></div>;

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const token = getAuthToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeDashboard />} />
        <Route path="orders" element={<ZamowieniaPanel />} />
        
        <Route path="warehouse" element={<Warehouse />} />
        <Route path="logistics" element={<Logistics />} />
        <Route path="products" element={<Produkty />} />
        <Route path="finance" element={<Finance />} />
        <Route path="users" element={<Users />} />
        <Route path="clients" element={<Clients />} />
        <Route path="contractors" element={<Contractors />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
};