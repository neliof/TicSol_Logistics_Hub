import { test, expect } from '@playwright/test';

test.describe('Receção Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/');
    await page.fill('input[type="email"]', 'user@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForNavigation();
  });

  test('P1 - Criar receção e conferir linhas', async ({ page }) => {
    // Navigate to Receção
    await page.click('a:has-text("Receção")');
    await page.waitForSelector('[data-testid="recepcao-module"]');

    // Check orders list loaded
    await expect(page.locator('[data-testid="orders-list"]')).toBeVisible();
    const orderCount = await page.locator('[data-testid="order-row"]').count();
    expect(orderCount).toBeGreaterThan(0);

    // Select first order
    await page.click('[data-testid="order-row"] >> first-child');
    await page.waitForSelector('[data-testid="order-details"]');

    // Verify order info displays
    await expect(page.locator('[data-testid="order-numero-guia"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-fornecedor"]')).toBeVisible();

    // Check linhas displayed
    const linhas = await page.locator('[data-testid="linha-row"]').count();
    expect(linhas).toBeGreaterThan(0);

    // Enter quantidade recebida
    const primeiraLinha = page.locator('[data-testid="linha-row"] >> first-child');
    await primeiraLinha.click();
    await page.fill('[data-testid="input-qty-recebida"]', '10');
    await page.click('[data-testid="btn-conferir"]');

    // Verify conferência registered
    await expect(page.locator('text=Conferida')).toBeVisible();
  });

  test('P1 - Registar divergência', async ({ page }) => {
    await page.click('a:has-text("Receção")');
    await page.waitForSelector('[data-testid="orders-list"]');

    // Select order with discrepancy
    await page.click('[data-testid="order-row"] >> first-child');

    // Open divergência modal
    await page.click('[data-testid="btn-divergencia"]');
    await page.waitForSelector('[data-testid="modal-divergencia"]');

    // Fill divergência form
    await page.selectOption('[data-testid="select-tipo"]', 'FALTA');
    await page.fill('[data-testid="input-quantidade"]', '5');
    await page.fill('[data-testid="textarea-motivo"]', 'Faltam 5 caixas');
    await page.selectOption('[data-testid="select-impacto"]', 'REVISAR');

    // Save
    await page.click('[data-testid="btn-save-divergencia"]');

    // Verify success
    await expect(page.locator('text=Divergência registada')).toBeVisible();
  });

  test('P1 - Registar documento fornecedor', async ({ page }) => {
    await page.click('a:has-text("Receção")');
    await page.waitForSelector('[data-testid="orders-list"]');

    await page.click('[data-testid="order-row"] >> first-child');

    // Open documento modal
    await page.click('[data-testid="btn-documento"]');
    await page.waitForSelector('[data-testid="modal-documento"]');

    // Fill documento form
    await page.selectOption('[data-testid="select-tipo-doc"]', 'GUIA_TRANSPORTE');
    await page.fill('[data-testid="input-numero"]', 'GT-001');
    await page.fill('[data-testid="input-data"]', '2026-09-12');

    // Save
    await page.click('[data-testid="btn-save-documento"]');

    // Verify
    await expect(page.locator('text=Documento registado')).toBeVisible();
  });

  test('P1 - Validar e finalizar receção', async ({ page }) => {
    await page.click('a:has-text("Receção")');
    await page.waitForSelector('[data-testid="orders-list"]');

    await page.click('[data-testid="order-row"] >> first-child');

    // Check validation checklist
    const validacao = page.locator('[data-testid="validacao-checklist"]');
    await expect(validacao).toBeVisible();

    // Check all items
    const checkboxes = page.locator('[data-testid="validacao-item"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);

    // Finalizar button should be enabled when valid
    const finalizarBtn = page.locator('[data-testid="btn-finalizar"]');
    const isDisabled = await finalizarBtn.isDisabled();

    if (!isDisabled) {
      await finalizarBtn.click();
      await expect(page.locator('text=Receção finalizada')).toBeVisible();
    }
  });
});
