(function () {
  if (typeof navigator === 'undefined' || !navigator.modelContext) return;

  navigator.modelContext.provideContext({
    tools: [
      {
        name: 'browse_dirt_bikes',
        description: 'Browse electric dirt bikes by category: adult, kids, or road-legal',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'One of: adult, kids, road-legal (leave blank for all dirt bikes)'
            }
          }
        },
        execute: async ({ category }) => {
          const map = {
            adult: 'https://volttrail.org/electric-dirt-bikes/adult',
            kids: 'https://volttrail.org/kids-electric-dirt-bikes',
            'road-legal': 'https://volttrail.org/road-legal-electric-bikes'
          };
          const url = (category && map[category]) || 'https://volttrail.org/electric-dirt-bikes';
          window.location.href = url;
          return { url };
        }
      },
      {
        name: 'browse_quad_bikes',
        description: 'Browse electric quad bikes by category: adult or kids',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'One of: adult, kids (leave blank for all quad bikes)'
            }
          }
        },
        execute: async ({ category }) => {
          const map = {
            adult: 'https://volttrail.org/electric-quad-bikes/adult',
            kids: 'https://volttrail.org/kids-electric-quad-bikes'
          };
          const url = (category && map[category]) || 'https://volttrail.org/electric-quad-bikes';
          window.location.href = url;
          return { url };
        }
      },
      {
        name: 'browse_parts_accessories',
        description: 'Browse parts and accessories: batteries-chargers, helmets-protection, riding-gear, parts-upgrades, tyres-wheels',
        inputSchema: {
          type: 'object',
          properties: {
            subcategory: { type: 'string', description: 'Parts & accessories subcategory slug' }
          }
        },
        execute: async ({ subcategory }) => {
          const url = subcategory
            ? `https://volttrail.org/parts-accessories/${subcategory}`
            : 'https://volttrail.org/parts-accessories';
          window.location.href = url;
          return { url };
        }
      },
      {
        name: 'compare_models',
        description: 'Open the side-by-side spec comparison tool',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          window.location.href = 'https://volttrail.org/compare';
          return { url: 'https://volttrail.org/compare' };
        }
      },
      {
        name: 'get_finance_info',
        description: 'View Pay in 4, Klarna and Clearpay financing options (18+, subject to status)',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          window.location.href = 'https://volttrail.org/finance';
          return { url: 'https://volttrail.org/finance' };
        }
      },
      {
        name: 'contact',
        description: 'Contact VoltTrail for product questions, orders or support',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          window.location.href = 'https://volttrail.org/contact';
          return { url: 'https://volttrail.org/contact' };
        }
      }
    ]
  });
})();
