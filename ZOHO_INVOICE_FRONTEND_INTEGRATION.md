# Zoho Invoice API - Frontend Integration Guide

## Overview
This guide provides instructions for integrating the Zoho Books Invoice API in your frontend application.

## Base URL
```
http://localhost:5001/api/zoho
```
(Replace with your production URL in production)

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## API Endpoints

### 1. Create Invoice
**POST** `/api/zoho/create-invoice`

Creates a new invoice in Zoho Books.

#### Request Body (Simple Format - Recommended for most cases)

```json
{
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "9876543210",
  "customerAddress": {
    "street": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "zipCode": "400001"
  },
  "lineItems": [
    {
      "name": "Assessment Fee",
      "description": "Technical Assessment for Software Developer",
      "rate": 500,
      "quantity": 1,
      "unit": "nos"
    },
    {
      "name": "Processing Fee",
      "description": "Transaction Processing",
      "rate": 50,
      "quantity": 1
    }
  ],
  "invoiceDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "paymentTerms": 30,
  "notes": "Payment due within 30 days",
  "referenceNumber": "INV-2024-001",
  "currencyCode": "INR"
}
```

#### Request Body (Full Zoho Books Format - Advanced)

```json
{
  "customer_id": 982000000567001,
  "invoice_number": "INV-00003",
  "date": "2024-01-15",
  "payment_terms": 15,
  "payment_terms_label": "Net 15",
  "due_date": "2024-02-01",
  "line_items": [
    {
      "item_id": 982000000030049,
      "name": "Assessment Fee",
      "description": "Technical Assessment",
      "rate": 500,
      "quantity": 1,
      "tax_id": 982000000557028,
      "tax_percentage": 18,
      "hsn_or_sac": 998314
    }
  ],
  "gst_treatment": "business_gst",
  "gst_no": "22AAAAA0000A1Z5",
  "place_of_supply": "MH",
  "notes": "Looking forward for your business.",
  "terms": "Terms & Conditions apply",
  "send": false
}
```

#### Success Response (201)

```json
{
  "success": true,
  "message": "Invoice created successfully in Zoho Books",
  "data": {
    "invoiceId": "123456789",
    "invoiceNumber": "INV-001",
    "invoiceUrl": "https://books.zoho.in/...",
    "invoicePdfUrl": "https://books.zoho.in/.../pdf/",
    "total": 500.00,
    "balance": 500.00,
    "status": "draft",
    "date": "2024-01-15",
    "dueDate": "2024-02-15",
    "customerId": "987654321",
    "customerName": "John Doe",
    "invoice": { ... }
  }
}
```

#### Error Response (400/500)

```json
{
  "success": false,
  "message": "Failed to create invoice in Zoho Books",
  "error": "Error message here",
  "details": { ... }
}
```

---

### 2. Get Invoice by ID
**GET** `/api/zoho/invoice/:invoiceId`

Retrieves a specific invoice from Zoho Books.

#### Example Request
```
GET /api/zoho/invoice/123456789
```

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "invoice": {
      "invoice_id": "123456789",
      "invoice_number": "INV-001",
      "date": "2024-01-15",
      "total": 500.00,
      "balance": 500.00,
      "status": "sent",
      ...
    }
  }
}
```

---

### 3. List Invoices
**GET** `/api/zoho/invoices`

Retrieves a list of invoices with pagination.

#### Query Parameters
- `page` (optional, default: 1) - Page number
- `per_page` (optional, default: 25) - Items per page
- `sort_column` (optional, default: "invoice_date") - Column to sort by
- `sort_order` (optional, default: "D") - Sort order (A = Ascending, D = Descending)

#### Example Request
```
GET /api/zoho/invoices?page=1&per_page=25&sort_column=invoice_date&sort_order=D
```

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "invoice_id": "123456789",
        "invoice_number": "INV-001",
        "date": "2024-01-15",
        "total": 500.00,
        "status": "sent",
        ...
      }
    ],
    "page_context": {
      "page": 1,
      "per_page": 25,
      "has_more_page": true,
      ...
    }
  }
}
```

---

## Frontend Implementation Examples

### React/Next.js Example

```typescript
// services/zohoInvoiceService.ts
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// Get auth token from your auth context/store
const getAuthToken = () => {
  return localStorage.getItem('accessToken') || '';
};

// Create Invoice
export const createInvoice = async (invoiceData: any) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/zoho/create-invoice`,
      invoiceData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.message || 'Failed to create invoice'
    );
  }
};

// Get Invoice by ID
export const getInvoice = async (invoiceId: string) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/zoho/invoice/${invoiceId}`,
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.message || 'Failed to fetch invoice'
    );
  }
};

// List Invoices
export const listInvoices = async (params?: {
  page?: number;
  per_page?: number;
  sort_column?: string;
  sort_order?: 'A' | 'D';
}) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/zoho/invoices`,
      {
        params: params || {},
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.message || 'Failed to fetch invoices'
    );
  }
};
```

### React Component Example

```tsx
// components/CreateInvoiceForm.tsx
import React, { useState } from 'react';
import { createInvoice } from '../services/zohoInvoiceService';

interface LineItem {
  name: string;
  description?: string;
  rate: number;
  quantity: number;
  unit?: string;
}

const CreateInvoiceForm: React.FC = () => {
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    lineItems: [
      {
        name: '',
        description: '',
        rate: 0,
        quantity: 1,
        unit: 'nos',
      },
    ] as LineItem[],
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    paymentTerms: 30,
    notes: '',
    referenceNumber: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await createInvoice(formData);
      setSuccess(result);
      // Reset form or redirect
      console.log('Invoice created:', result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addLineItem = () => {
    setFormData({
      ...formData,
      lineItems: [
        ...formData.lineItems,
        {
          name: '',
          description: '',
          rate: 0,
          quantity: 1,
          unit: 'nos',
        },
      ],
    });
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updatedItems = [...formData.lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setFormData({ ...formData, lineItems: updatedItems });
  };

  return (
    <form onSubmit={handleSubmit} className="invoice-form">
      <h2>Create Invoice</h2>

      {/* Customer Details */}
      <div className="form-section">
        <h3>Customer Details</h3>
        <input
          type="text"
          placeholder="Customer Name *"
          value={formData.customerName}
          onChange={(e) =>
            setFormData({ ...formData, customerName: e.target.value })
          }
          required
        />
        <input
          type="email"
          placeholder="Customer Email *"
          value={formData.customerEmail}
          onChange={(e) =>
            setFormData({ ...formData, customerEmail: e.target.value })
          }
          required
        />
        <input
          type="tel"
          placeholder="Customer Phone"
          value={formData.customerPhone}
          onChange={(e) =>
            setFormData({ ...formData, customerPhone: e.target.value })
          }
        />
      </div>

      {/* Line Items */}
      <div className="form-section">
        <h3>Line Items</h3>
        {formData.lineItems.map((item, index) => (
          <div key={index} className="line-item">
            <input
              type="text"
              placeholder="Item Name *"
              value={item.name}
              onChange={(e) =>
                updateLineItem(index, 'name', e.target.value)
              }
              required
            />
            <input
              type="text"
              placeholder="Description"
              value={item.description || ''}
              onChange={(e) =>
                updateLineItem(index, 'description', e.target.value)
              }
            />
            <input
              type="number"
              placeholder="Rate *"
              value={item.rate}
              onChange={(e) =>
                updateLineItem(index, 'rate', parseFloat(e.target.value))
              }
              required
            />
            <input
              type="number"
              placeholder="Quantity *"
              value={item.quantity}
              onChange={(e) =>
                updateLineItem(index, 'quantity', parseInt(e.target.value))
              }
              required
            />
            <input
              type="text"
              placeholder="Unit"
              value={item.unit || 'nos'}
              onChange={(e) =>
                updateLineItem(index, 'unit', e.target.value)
              }
            />
          </div>
        ))}
        <button type="button" onClick={addLineItem}>
          Add Line Item
        </button>
      </div>

      {/* Invoice Details */}
      <div className="form-section">
        <h3>Invoice Details</h3>
        <input
          type="date"
          label="Invoice Date"
          value={formData.invoiceDate}
          onChange={(e) =>
            setFormData({ ...formData, invoiceDate: e.target.value })
          }
        />
        <input
          type="date"
          label="Due Date"
          value={formData.dueDate}
          onChange={(e) =>
            setFormData({ ...formData, dueDate: e.target.value })
          }
        />
        <input
          type="number"
          placeholder="Payment Terms (Days)"
          value={formData.paymentTerms}
          onChange={(e) =>
            setFormData({
              ...formData,
              paymentTerms: parseInt(e.target.value),
            })
          }
        />
        <input
          type="text"
          placeholder="Reference Number"
          value={formData.referenceNumber}
          onChange={(e) =>
            setFormData({ ...formData, referenceNumber: e.target.value })
          }
        />
        <textarea
          placeholder="Notes"
          value={formData.notes}
          onChange={(e) =>
            setFormData({ ...formData, notes: e.target.value })
          }
        />
      </div>

      {error && <div className="error">{error}</div>}
      {success && (
        <div className="success">
          <p>Invoice created successfully!</p>
          <p>Invoice Number: {success.data.invoiceNumber}</p>
          <a
            href={success.data.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View Invoice
          </a>
        </div>
      )}

      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Invoice'}
      </button>
    </form>
  );
};

export default CreateInvoiceForm;
```

### Vue.js Example

```javascript
// services/zohoInvoice.js
import axios from 'axios';

const API_BASE_URL = process.env.VUE_APP_API_URL || 'http://localhost:5001';

export const zohoInvoiceService = {
  async createInvoice(invoiceData) {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        `${API_BASE_URL}/api/zoho/create-invoice`,
        invoiceData,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message || 'Failed to create invoice'
      );
    }
  },

  async getInvoice(invoiceId) {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(
        `${API_BASE_URL}/api/zoho/invoice/${invoiceId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message || 'Failed to fetch invoice'
      );
    }
  },

  async listInvoices(params = {}) {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(
        `${API_BASE_URL}/api/zoho/invoices`,
        {
          params,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message || 'Failed to fetch invoices'
      );
    }
  },
};
```

### Vanilla JavaScript/Fetch Example

```javascript
// zohoInvoice.js
const API_BASE_URL = 'http://localhost:5001';

class ZohoInvoiceAPI {
  constructor() {
    this.getAuthToken = () => {
      return localStorage.getItem('accessToken') || '';
    };
  }

  async createInvoice(invoiceData) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/zoho/create-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify(invoiceData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create invoice');
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  async getInvoice(invoiceId) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/zoho/invoice/${invoiceId}`,
        {
          headers: {
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch invoice');
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  async listInvoices(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = `${API_BASE_URL}/api/zoho/invoices${
        queryString ? `?${queryString}` : ''
      }`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch invoices');
      }

      return data;
    } catch (error) {
      throw error;
    }
  }
}

// Usage
const zohoAPI = new ZohoInvoiceAPI();

// Create invoice
const invoiceData = {
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  lineItems: [
    {
      name: 'Assessment Fee',
      rate: 500,
      quantity: 1,
    },
  ],
};

zohoAPI
  .createInvoice(invoiceData)
  .then((result) => {
    console.log('Invoice created:', result);
    // Handle success
  })
  .catch((error) => {
    console.error('Error:', error);
    // Handle error
  });
```

---

## Error Handling

Always implement proper error handling:

```typescript
try {
  const result = await createInvoice(invoiceData);
  // Success handling
  toast.success('Invoice created successfully!');
  navigate(`/invoices/${result.data.invoiceId}`);
} catch (error: any) {
  // Error handling
  if (error.response?.status === 401) {
    // Handle unauthorized - redirect to login
    router.push('/login');
  } else if (error.response?.status === 400) {
    // Handle validation errors
    toast.error(error.response.data.message);
  } else {
    // Handle other errors
    toast.error('Failed to create invoice. Please try again.');
  }
}
```

---

## Required Fields

### Minimum Required for Simple Format:
- `customerName` (string)
- `customerEmail` (string)
- `lineItems` (array) - At least one item with:
  - `name` (string)
  - `rate` (number)
  - `quantity` (number)

### Optional Fields:
- `customerPhone`, `customerAddress`
- `invoiceDate`, `dueDate`, `paymentTerms`
- `notes`, `referenceNumber`, `currencyCode`

---

## Notes

1. **Authentication**: All requests require a valid JWT token in the Authorization header
2. **Customer Creation**: If `customer_id` is not provided, the system will automatically create or find the customer using the provided email
3. **Date Format**: Use ISO date format (YYYY-MM-DD)
4. **Currency**: Default is INR, but can be changed via `currencyCode` or `currency_id`
5. **Line Items**: At least one line item is required
6. **Error Responses**: Always check the `success` field in the response

---

## Testing

You can test the API using Postman or cURL:

```bash
curl -X POST http://localhost:5001/api/zoho/create-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "lineItems": [
      {
        "name": "Assessment Fee",
        "rate": 500,
        "quantity": 1
      }
    ]
  }'
```

