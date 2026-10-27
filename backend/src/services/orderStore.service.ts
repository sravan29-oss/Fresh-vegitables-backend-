import fs from 'fs';
import path from 'path';
import { memoryStore } from '../config/mockDb';

const ORDERS_FILE = path.join(__dirname, '..', 'config', 'orders.json');
const ORDER_ITEMS_FILE = path.join(__dirname, '..', 'config', 'order_items.json');

export function readOrdersFromFile(): any[] {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const data = fs.readFileSync(ORDERS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed reading orders.json:', err);
  }
  return [];
}

export function writeOrdersToFile(orders: any[]): void {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed writing orders.json:', err);
  }
}

export function readOrderItemsFromFile(): any[] {
  try {
    if (fs.existsSync(ORDER_ITEMS_FILE)) {
      const data = fs.readFileSync(ORDER_ITEMS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed reading order_items.json:', err);
  }
  return [];
}

export function writeOrderItemsToFile(items: any[]): void {
  try {
    fs.writeFileSync(ORDER_ITEMS_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed writing order_items.json:', err);
  }
}

// Initial hydration without seeding any fake orders
const initialOrders = readOrdersFromFile();
memoryStore.orders = initialOrders;

const initialOrderItems = readOrderItemsFromFile();
memoryStore.order_items = initialOrderItems;

export function getPersistedOrders(): any[] {
  return memoryStore.orders;
}

export function savePersistedOrders(orders: any[]): any[] {
  memoryStore.orders = orders;
  writeOrdersToFile(orders);
  return orders;
}

export function savePersistedOrderItems(items: any[]): any[] {
  memoryStore.order_items = items;
  writeOrderItemsToFile(items);
  return items;
}
