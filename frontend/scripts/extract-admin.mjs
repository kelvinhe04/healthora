import fs from 'fs';
import path from 'path';

const base = path.resolve('src/pages/admin');
const lines = fs.readFileSync(path.join(base, 'AdminApp.tsx'), 'utf8').split(/\r?\n/);
const extract = (s, e) => lines.slice(s - 1, e).join('\n');

let typesBody = extract(45, 157);
typesBody = typesBody.replace(/^type /gm, 'export type ');
typesBody = typesBody.replace(/^interface /gm, 'export interface ');
typesBody = typesBody.replace(/^const /gm, 'export const ');
fs.writeFileSync(
  path.join(base, 'types.ts'),
  "import type { FulfillmentStatus, OrderAddress, OrderLineItem, PaymentStatus, Product } from '../../types';\n\n" +
    typesBody +
    '\n',
);

let utilsBody = extract(159, 393);
utilsBody = utilsBody.replace(/^const ADMIN_PAGE_SIZE/gm, 'export const ADMIN_PAGE_SIZE');
utilsBody = utilsBody.replace(/^function /gm, 'export function ');
fs.writeFileSync(
  path.join(base, 'utils.ts'),
  "import type { FulfillmentStatus, Product } from '../../types';\nimport type { ProductForm } from './types';\nimport { fulfillmentStatusSequence } from './types';\n\n" +
    utilsBody +
    '\n',
);

let pc = extract(174, 251).replace('function PaginationControls', 'export function PaginationControls');
fs.writeFileSync(
  path.join(base, 'components/PaginationControls.tsx'),
  "import { ADMIN_PAGE_SIZE } from '../utils';\n\n" + pc + '\n',
);

let idz = extract(397, 566).replace('function ImageDropZone', 'export function ImageDropZone');
fs.writeFileSync(
  path.join(base, 'components/ImageDropZone.tsx'),
  "import { type DragEvent, useRef, useState } from 'react';\nimport { Icon } from '../../../components/shared/Icon';\n\n" +
    idz +
    '\n',
);

let pm = extract(570, 1173).replace('function ProductModal', 'export function ProductModal');
fs.writeFileSync(
  path.join(base, 'components/ProductModal.tsx'),
  "import { type ChangeEvent, useEffect, useState } from 'react';\nimport type { Product } from '../../../types';\nimport { AnimatedButton } from '../../../components/shared/AnimatedButton';\nimport { Icon } from '../../../components/shared/Icon';\nimport { ModalOverlay } from '../../../components/shared/ModalOverlay';\nimport { emptyForm, type ProductForm } from '../types';\nimport { formToPayload, productToForm } from '../utils';\nimport { ImageDropZone } from './ImageDropZone';\n\n" +
    pm +
    '\n',
);

let uth = extract(1177, 1184).replace('function useAdminToken', 'export function useAdminToken');
fs.writeFileSync(
  path.join(base, 'hooks/useAdminToken.ts'),
  "import { useAuth } from '@clerk/clerk-react';\n\n" + uth + '\n',
);

let gate = extract(1188, 1346).replace('function AdminAccessGate', 'export function AdminAccessGate');
fs.writeFileSync(
  path.join(base, 'AdminAccessGate.tsx'),
  "import { useQuery } from '@tanstack/react-query';\nimport { useClerk, useUser } from '@clerk/clerk-react';\nimport { AnimatedButton } from '../../components/shared/AnimatedButton';\nimport { api } from '../../lib/api';\nimport type { AdminAccess } from './types';\nimport { AdminPanel } from './AdminPanel';\nimport { useAdminToken } from './hooks/useAdminToken';\n\n" +
    gate +
    '\n',
);

// AdminPanel = rest of file (1348-end) minus export default
let panel = extract(1348, lines.length);
panel = panel.replace(/^export default function AdminApp/m, 'export function AdminPanel');
fs.writeFileSync(
  path.join(base, 'AdminPanel.tsx'),
  `import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useClerk } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatedButton } from '../../components/shared/AnimatedButton';
import { Icon } from '../../components/shared/Icon';
import { api } from '../../lib/api';
import type { FulfillmentStatus, Product } from '../../types';
import { PaginationControls } from './components/PaginationControls';
import { ProductModal } from './components/ProductModal';
import {
  type AdminOrder,
  type AdminPage,
  type AdminUser,
  type DashboardData,
  type EarningsData,
  type ProductForm,
  type SalesData,
  emptyForm,
  fulfillmentStatusLabels,
  fulfillmentStatusOptions,
} from './types';
import { getNextFulfillmentStatus, paginateItems } from './utils';
import { useAdminToken } from './hooks/useAdminToken';

` +
    panel +
    '\n',
);

fs.writeFileSync(
  path.join(base, 'AdminApp.tsx'),
  `import type { AdminAppProps } from './types';
import { AdminAccessGate } from './AdminAccessGate';

export function AdminApp({ onExit }: AdminAppProps) {
  return <AdminAccessGate onExit={onExit} />;
}
`,
);

console.log('extracted admin modules');
