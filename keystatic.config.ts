import { config, fields, collection } from '@keystatic/core'

export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    work: collection({
      label: 'Case Studies',
      slugField: 'title',
      path: 'content/work/*/',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        client: fields.text({
          label: 'Client Name',
          validation: { isRequired: true },
        }),
        industry: fields.text({
          label: 'Industry',
          description: 'e.g. SaaS, Restaurant, Retail',
          validation: { isRequired: true },
        }),
        description: fields.text({
          label: 'Description',
          description: 'Short summary for card view and SEO (under 160 characters)',
          validation: { isRequired: true },
        }),
        challenge: fields.text({
          label: 'The Challenge',
          description: 'What problem did the client face?',
          multiline: true,
          validation: { isRequired: true },
        }),
        solution: fields.text({
          label: 'Our Approach',
          description: 'How did we solve it?',
          multiline: true,
          validation: { isRequired: true },
        }),
        results: fields.array(
          fields.text({ label: 'Result' }),
          {
            label: 'Key Results',
            description: 'Quantified outcomes (e.g. "40% faster load time")',
            itemLabel: (props) => props.value || 'Result',
          }
        ),
        testimonial: fields.object({
          quote: fields.text({ label: 'Quote', multiline: true }),
          name: fields.text({ label: 'Name' }),
          role: fields.text({ label: 'Role / Title' }),
        }, { label: 'Client Testimonial' }),
        services: fields.multiselect({
          label: 'Services Provided',
          options: [
            { label: 'Web Design', value: 'design' },
            { label: 'Web Development', value: 'development' },
            { label: 'SEO', value: 'seo' },
            { label: 'CMS Setup', value: 'cms' },
            { label: 'E-commerce', value: 'ecommerce' },
            { label: 'Migration', value: 'migration' },
            { label: 'Marketing Admin', value: 'marketing-admin' },
            { label: 'Social Media', value: 'social' },
            { label: 'Analytics', value: 'analytics' },
          ],
        }),
        timeline: fields.text({
          label: 'Project Timeline',
          description: 'e.g. "3 weeks"',
        }),
        publishedDate: fields.date({
          label: 'Published Date',
          validation: { isRequired: true },
        }),
        liveUrl: fields.url({
          label: 'Live Site URL',
          description: 'Link to the deployed project',
        }),
        ogImage: fields.image({
          label: 'Cover Image',
          directory: 'public/images/work',
          publicPath: '/images/work/',
        }),
        screenshots: fields.array(
          fields.image({
            label: 'Screenshot',
            directory: 'public/images/work',
            publicPath: '/images/work/',
          }),
          {
            label: 'Page Screenshots',
            description: '3 screenshots of other pages (shown at bottom of case study)',
            itemLabel: (props) => props.value || 'Screenshot',
          }
        ),
        featured: fields.checkbox({
          label: 'Featured',
          defaultValue: false,
          description: 'Show on homepage as featured case study',
        }),
        draft: fields.checkbox({
          label: 'Draft',
          defaultValue: false,
        }),
        content: fields.markdoc({
          label: 'Full Case Study',
        }),
      },
    }),
    blog: collection({
      label: 'Blog Posts',
      slugField: 'title',
      path: 'content/blog/*/',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({
          label: 'Description',
          description: 'SEO meta description (under 160 characters)',
          validation: { isRequired: true },
        }),
        publishedDate: fields.date({
          label: 'Published Date',
          validation: { isRequired: true },
        }),
        ogImage: fields.image({
          label: 'OG Image',
          directory: 'public/images/blog',
          publicPath: '/images/blog/',
        }),
        draft: fields.checkbox({
          label: 'Draft',
          defaultValue: false,
          description: 'Draft posts are not shown on the public site',
        }),
        content: fields.markdoc({
          label: 'Content',
        }),
      },
    }),
  },
})
