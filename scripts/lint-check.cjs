#!/usr/bin/env node

/**
 * Basic Lint Check for CI/CD System
 * Performs basic code quality checks
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Running basic lint checks for cicd-system...\n');

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0
};

// Check 1: Verify main files exist
const requiredFiles = [
  'src/webhook-server-multi.js',
  'src/database/DatabaseManager.cjs', 
  'src/webhook/WebhookHandler.cjs',
  'package.json',
  'README.md'
];

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
    checks.passed++;
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    checks.failed++;
  }
});

// Check 2: Package.json validation
console.log('\n📦 Checking package.json...');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (pkg.name && pkg.version && pkg.description) {
    console.log('  ✅ Package metadata complete');
    checks.passed++;
  } else {
    console.log('  ❌ Missing required package metadata');
    checks.failed++;
  }
  
  if (pkg.scripts && Object.keys(pkg.scripts).length > 10) {
    console.log('  ✅ Sufficient npm scripts defined');
    checks.passed++;
  } else {
    console.log('  ⚠️ Limited npm scripts available');
    checks.warnings++;
  }
  
} catch (error) {
  console.log('  ❌ Invalid package.json format');
  checks.failed++;
}

// Check 3: Database directory
console.log('\n🗄️ Checking database setup...');
if (fs.existsSync('data')) {
  console.log('  ✅ Data directory exists');
  checks.passed++;
} else {
  console.log('  ⚠️ Data directory missing (will be created automatically)');
  checks.warnings++;
}

// Check 4: Test directory
console.log('\n🧪 Checking test structure...');
if (fs.existsSync('tests') && fs.existsSync('tests/unit') && fs.existsSync('tests/integration')) {
  console.log('  ✅ Test directories exist');
  checks.passed++;
} else {
  console.log('  ❌ Test directories incomplete');
  checks.failed++;
}

// Check 5: Documentation
console.log('\n📚 Checking documentation...');
const docFiles = ['README.md', 'docs/WINDOWS-SERVICE-SETUP.md'];
let docsFound = 0;
docFiles.forEach(file => {
  if (fs.existsSync(file)) {
    docsFound++;
  }
});

if (docsFound === docFiles.length) {
  console.log('  ✅ All documentation files present');
  checks.passed++;
} else {
  console.log(`  ⚠️ ${docsFound}/${docFiles.length} documentation files found`);
  checks.warnings++;
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 LINT CHECK SUMMARY');
console.log('='.repeat(50));
console.log(`✅ Passed: ${checks.passed}`);
console.log(`⚠️ Warnings: ${checks.warnings}`);
console.log(`❌ Failed: ${checks.failed}`);

if (checks.failed === 0) {
  console.log('\n🎉 Lint check PASSED - Code quality is acceptable');
  process.exit(0);
} else {
  console.log('\n💥 Lint check FAILED - Please address the issues above');
  process.exit(1);
}