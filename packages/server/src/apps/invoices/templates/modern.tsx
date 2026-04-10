import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { InvoiceTemplateProps } from './types';

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#1a1a1a',
    paddingBottom: 60,
  },
  // Accent bar at top
  accentBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 48,
    marginBottom: 28,
  },
  accentBarLogo: {
    width: 30,
    height: 30,
    objectFit: 'contain',
    marginRight: 12,
  },
  accentBarCompanyName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    flex: 1,
  },
  accentBarInvoiceLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    opacity: 0.85,
    letterSpacing: 1.5,
  },
  // Content area padding
  content: {
    paddingHorizontal: 48,
  },
  // Company info below the bar
  companyInfoBlock: {
    marginBottom: 20,
  },
  companyInfoLine: {
    fontSize: 8,
    color: '#6b7280',
    marginBottom: 2,
  },
  // Two-column cards
  twoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 12,
  },
  cardLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  clientName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  clientLine: {
    fontSize: 8,
    color: '#4b5563',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  metaRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  metaKey: {
    fontSize: 8,
    color: '#9ca3af',
  },
  metaValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  // Table
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  colDescription: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colUnitPrice: { flex: 1.5, textAlign: 'right' },
  colAmount: { flex: 1.5, textAlign: 'right' },
  tableCell: {
    fontSize: 8,
    color: '#374151',
  },
  tableCellRight: {
    fontSize: 8,
    color: '#374151',
    textAlign: 'right',
  },
  // Totals
  totalsBlock: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
    width: 220,
  },
  totalsLabel: {
    fontSize: 8,
    color: '#6b7280',
    width: 110,
    textAlign: 'right',
    marginRight: 16,
  },
  totalsValue: {
    fontSize: 8,
    color: '#374151',
    width: 100,
    textAlign: 'right',
  },
  totalRowFinal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
    paddingTop: 6,
    width: 220,
    borderTopWidth: 1.5,
    borderTopColor: '#d1d5db',
  },
  totalLabelFinal: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    width: 110,
    textAlign: 'right',
    marginRight: 16,
    color: '#111827',
  },
  totalValueFinal: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    width: 100,
    textAlign: 'right',
  },
  // Info sections (payment/notes)
  infoSection: {
    marginBottom: 14,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    borderLeftWidth: 3,
  },
  infoSectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    color: '#111827',
  },
  infoSectionText: {
    fontSize: 8,
    color: '#4b5563',
    lineHeight: 1.6,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: 'center',
    fontSize: 7,
    color: '#9ca3af',
  },
  // Status badge
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: 'flex-end',
  },
  statusText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
});

export function ModernTemplate({ invoice, lineItems, branding, client }: InvoiceTemplateProps) {
  const accent = branding.accentColor || '#13715B';

  const statusColors: Record<string, string> = {
    paid: '#16a34a',
    draft: '#6b7280',
    sent: '#2563eb',
    overdue: '#dc2626',
    cancelled: '#9ca3af',
  };
  const statusColor = statusColors[invoice.status?.toLowerCase()] || '#6b7280';
  const statusLabel = invoice.status
    ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)
    : '';

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accent }]}>
          {branding.logoBase64 ? (
            <Image style={styles.accentBarLogo} src={`data:image/png;base64,${branding.logoBase64}`} />
          ) : null}
          <Text style={styles.accentBarCompanyName}>
            {branding.companyName || 'Company Name'}
          </Text>
          <Text style={styles.accentBarInvoiceLabel}>INVOICE</Text>
        </View>

        <View style={styles.content}>

          {/* Company info block */}
          <View style={styles.companyInfoBlock}>
            {branding.companyAddress ? (
              <Text style={styles.companyInfoLine}>{branding.companyAddress}</Text>
            ) : null}
            {(branding.companyCity || branding.companyCountry) ? (
              <Text style={styles.companyInfoLine}>
                {[branding.companyCity, branding.companyCountry].filter(Boolean).join(', ')}
              </Text>
            ) : null}
            {branding.companyPhone ? (
              <Text style={styles.companyInfoLine}>{branding.companyPhone}</Text>
            ) : null}
            {branding.companyEmail ? (
              <Text style={styles.companyInfoLine}>{branding.companyEmail}</Text>
            ) : null}
            {branding.companyWebsite ? (
              <Text style={styles.companyInfoLine}>{branding.companyWebsite}</Text>
            ) : null}
            {branding.companyTaxId ? (
              <Text style={styles.companyInfoLine}>Tax ID: {branding.companyTaxId}</Text>
            ) : null}
          </View>

          {/* Two-column cards: Bill To + Invoice Meta */}
          <View style={styles.twoCol}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Bill To</Text>
              <Text style={styles.clientName}>{client.name}</Text>
              {client.address ? <Text style={styles.clientLine}>{client.address}</Text> : null}
              {(client.city || client.state || client.postalCode) ? (
                <Text style={styles.clientLine}>
                  {[client.city, client.state, client.postalCode].filter(Boolean).join(', ')}
                </Text>
              ) : null}
              {client.country ? <Text style={styles.clientLine}>{client.country}</Text> : null}
              {client.taxId ? <Text style={styles.clientLine}>Tax ID: {client.taxId}</Text> : null}
              {client.contactName ? (
                <Text style={[styles.clientLine, { marginTop: 5 }]}>{client.contactName}</Text>
              ) : null}
              {client.contactEmail ? <Text style={styles.clientLine}>{client.contactEmail}</Text> : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Invoice Details</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>Invoice #</Text>
                <Text style={styles.metaValue}>{invoice.invoiceNumber}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>Issue Date</Text>
                <Text style={styles.metaValue}>{formatDate(invoice.issueDate)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>Due Date</Text>
                <Text style={styles.metaValue}>{formatDate(invoice.dueDate)}</Text>
              </View>
              <View style={styles.metaRowLast}>
                <Text style={styles.metaKey}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                  <Text style={styles.statusText}>{statusLabel}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Line items table */}
          <View style={styles.table}>
            <View style={[styles.tableHeader, { backgroundColor: accent }]}>
              <Text style={[styles.tableHeaderText, styles.colDescription]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
              <Text style={[styles.tableHeaderText, styles.colUnitPrice]}>Unit Price</Text>
              <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount</Text>
            </View>

            {lineItems.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colDescription]}>{item.description}</Text>
                <Text style={[styles.tableCellRight, styles.colQty]}>{item.quantity}</Text>
                <Text style={[styles.tableCellRight, styles.colUnitPrice]}>
                  {formatCurrency(item.unitPrice, invoice.currency)}
                </Text>
                <Text style={[styles.tableCellRight, styles.colAmount]}>
                  {formatCurrency(item.amount, invoice.currency)}
                </Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{formatCurrency(invoice.subtotal, invoice.currency)}</Text>
            </View>
            {invoice.taxAmount > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Tax ({invoice.taxPercent}%)</Text>
                <Text style={styles.totalsValue}>{formatCurrency(invoice.taxAmount, invoice.currency)}</Text>
              </View>
            ) : null}
            {invoice.discountAmount > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Discount ({invoice.discountPercent}%)</Text>
                <Text style={[styles.totalsValue, { color: '#16a34a' }]}>
                  -{formatCurrency(invoice.discountAmount, invoice.currency)}
                </Text>
              </View>
            ) : null}
            <View style={styles.totalRowFinal}>
              <Text style={styles.totalLabelFinal}>Total</Text>
              <Text style={[styles.totalValueFinal, { color: accent }]}>
                {formatCurrency(invoice.total, invoice.currency)}
              </Text>
            </View>
          </View>

          {/* Payment information */}
          {(branding.paymentInstructions || branding.bankDetails) ? (
            <View style={[styles.infoSection, { borderLeftColor: accent }]}>
              <Text style={[styles.infoSectionTitle, { color: accent }]}>Payment Information</Text>
              {branding.paymentInstructions ? (
                <Text style={styles.infoSectionText}>{branding.paymentInstructions}</Text>
              ) : null}
              {branding.bankDetails ? (
                <Text style={[styles.infoSectionText, { marginTop: 4 }]}>{branding.bankDetails}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Notes */}
          {invoice.notes ? (
            <View style={[styles.infoSection, { borderLeftColor: '#d1d5db' }]}>
              <Text style={styles.infoSectionTitle}>Notes</Text>
              <Text style={styles.infoSectionText}>{invoice.notes}</Text>
            </View>
          ) : null}

        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {branding.footerText || 'Generated by Atlas'}
        </Text>

      </Page>
    </Document>
  );
}
