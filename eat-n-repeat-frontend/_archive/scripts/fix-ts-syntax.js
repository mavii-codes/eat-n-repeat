const fs = require('fs');

function fixAdminDataContext() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\context\\AdminDataContext.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  
  // The file has a duplicate "use client"; and broken imports at the top
  const correctHeader = `"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { initialAdminData } from "@/lib/admin/mock-data";
import { initialDeliveryTeam, getSuggestedDeliveryPerson } from "@/lib/admin/delivery-utils";
import { getApiUrl } from "@/lib/config";
import type {
  AdminDataState,
  AvailabilityStatus,
  DeliveryOrder,
  DeliveryOrderInput,
  DeliverySettings,
  DeliveryStatus,
  DeliveryTeamMember,
  AssignmentLogEntry,
  MenuCategory,
  MenuCategoryInput,
  MenuItem,
  MenuItemInput,
  RecentOrder,
  ServiceArea,
  ServiceAreaInput,
  StaffAccount,
  StaffAccountInput,
  StockCategory,
  StockCategoryInput,
  StockItem,
  StockItemInput,
  StockRequest,
  StockRequestInput,
  SystemSettings,
} from "@/lib/admin/types";

const STORAGE_KEY = "eat-n-repeat-admin-data";

function createId(prefix: string) {`;

  // Replace everything up to `function createId(prefix: string) {`
  const splitIndex = content.indexOf('function createId(prefix: string) {');
  if (splitIndex !== -1) {
    content = correctHeader + content.slice(splitIndex + 'function createId(prefix: string) {'.length);
    fs.writeFileSync(file, content);
    console.log('Fixed AdminDataContext.tsx');
  } else {
    console.log('Could not find createId in AdminDataContext.tsx');
  }
}

function fixReportsPage() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\app\\admin\\delivery\\reports\\page.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  
  content = content.replace(`import {
import { getApiUrl } from "@/lib/config";
import {
  BarChart,`, `import { getApiUrl } from "@/lib/config";
import {
  BarChart,`);

  fs.writeFileSync(file, content);
  console.log('Fixed reports page.tsx');
}

fixAdminDataContext();
fixReportsPage();
