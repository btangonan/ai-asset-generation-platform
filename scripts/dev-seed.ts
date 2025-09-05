#!/usr/bin/env tsx

/**
 * Development seed script
 * Sets up sample data for testing the AI asset generation platform
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

interface SeedData {
  referencePacksData: Array<{
    id: string;
    name: string;
    description: string;
    imageCount: number;
    style: string;
  }>;
  
  styleKitsData: Array<{
    id: string;
    name: string;
    description: string;
    canonicalImages: string[];
  }>;
  
  sampleRows: Array<Record<string, string>>;
}

async function seedDevelopmentData(): Promise<void> {
  console.log('🌱 Seeding development data...');

  try {
    // Load sheet template data
    const csvPath = resolve(process.cwd(), 'tools/sheet-template.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    const [headers, ...rows] = csvContent.trim().split('\n');
    const sampleRows = rows.map(row => {
      const values = row.split(',');
      const rowObject: Record<string, string> = {};
      headers.split(',').forEach((header, index) => {
        rowObject[header] = values[index] || '';
      });
      return rowObject;
    });

    const seedData: SeedData = {
      referencePacksData: [
        {
          id: 'RP-kitchen-cozy',
          name: 'Cozy Kitchen Pack',
          description: 'Warm, inviting kitchen spaces with wood elements',
          imageCount: 8,
          style: 'cozy-residential'
        },
        {
          id: 'RP-living-natural',
          name: 'Natural Living Room Pack', 
          description: 'Living rooms with natural light and organic elements',
          imageCount: 6,
          style: 'natural-modern'
        },
        {
          id: 'RP-kitchen-modern',
          name: 'Modern Kitchen Pack',
          description: 'Sleek, minimalist kitchen designs',
          imageCount: 10,
          style: 'contemporary-minimal'
        },
        {
          id: 'RP-bedroom-peaceful',
          name: 'Peaceful Bedroom Pack',
          description: 'Calming bedroom environments',
          imageCount: 7,
          style: 'serene-residential'
        }
      ],

      styleKitsData: [
        {
          id: 'SK-warm',
          name: 'Warm Residential',
          description: 'Warm lighting, natural materials, cozy atmosphere',
          canonicalImages: [
            'warm-kitchen-hero.jpg',
            'cozy-lighting-ref.jpg',
            'wood-texture-sample.jpg'
          ]
        },
        {
          id: 'SK-modern',
          name: 'Contemporary Modern',
          description: 'Clean lines, neutral colors, minimalist approach',
          canonicalImages: [
            'modern-kitchen-clean.jpg',
            'minimal-design-ref.jpg',
            'neutral-palette.jpg'
          ]
        },
        {
          id: 'SK-natural',
          name: 'Natural Light',
          description: 'Emphasize natural lighting and organic elements',
          canonicalImages: [
            'natural-light-interior.jpg',
            'plant-integration.jpg',
            'organic-materials.jpg'
          ]
        }
      ],

      sampleRows
    };

    // Write seed data summary
    console.log('📊 Seed Data Summary:');
    console.log(`   Reference Packs: ${seedData.referencePacksData.length}`);
    console.log(`   Style Kits: ${seedData.styleKitsData.length}`);  
    console.log(`   Sample Sheet Rows: ${seedData.sampleRows.length}`);
    
    console.log('\n📋 Sample Scenes:');
    seedData.sampleRows.forEach(row => {
      console.log(`   ${row.scene_id}: ${row.prompt.substring(0, 60)}...`);
    });

    console.log('\n🎨 Reference Packs:');
    seedData.referencePacksData.forEach(pack => {
      console.log(`   ${pack.id}: ${pack.name} (${pack.imageCount} images)`);
    });

    console.log('\n✅ Development data seeded successfully!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Import the CSV template into your Google Sheet');
    console.log('   2. Update ref_pack_public_url with actual GCS signed URLs');
    console.log('   3. Install the Apps Script UI (tools/apps_script/Code.gs)');
    console.log('   4. Update API_BASE_URL in Apps Script config');
    console.log('   5. Test with "Generate Images (Dry-Run)" first');

  } catch (error) {
    console.error('❌ Failed to seed development data:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDevelopmentData().catch(console.error);
}

export { seedDevelopmentData };