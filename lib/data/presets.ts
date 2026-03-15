export type SearchOperator =
  | "site"
  | "inurl"
  | "intitle"
  | "intext"
  | "filetype"
  | "before"
  | "after";

export type PresetCategory =
  | "configuration"
  | "directories"
  | "documents"
  | "social"
  | "targeting";

export type QueryPreset = {
  id: string;
  name: string;
  description: string;
  category: PresetCategory;
  operators: Partial<Record<SearchOperator, string>>;
  freeText?: string;
  tags: string[];
};

export type FileFormatGroup = "document" | "config" | "archive";

export type FileFormatDefinition = {
  extension: string;
  label: string;
  group: FileFormatGroup;
  colorClass: string;
  badgeClass: string;
  description: string;
};

export const SEARCH_OPERATORS: Array<{
  key: SearchOperator;
  label: string;
  placeholder: string;
  description: string;
}> = [
  {
    key: "site",
    label: "site",
    placeholder: "example.com",
    description: "Restrict results to a specific domain or subdomain.",
  },
  {
    key: "inurl",
    label: "inurl",
    placeholder: "admin | uploads | backup",
    description: "Match terms that appear in the URL path.",
  },
  {
    key: "intitle",
    label: "intitle",
    placeholder: "index of | login | confidential",
    description: "Match terms that appear in the page title.",
  },
  {
    key: "intext",
    label: "intext",
    placeholder: "password | internal use only",
    description: "Match terms found in visible page text.",
  },
  {
    key: "filetype",
    label: "filetype",
    placeholder: "pdf | json | sql",
    description: "Restrict results to a specific file extension.",
  },
  {
    key: "before",
    label: "before",
    placeholder: "2024-12-31",
    description: "Only return results indexed before this date.",
  },
  {
    key: "after",
    label: "after",
    placeholder: "2024-01-01",
    description: "Only return results indexed after this date.",
  },
];

export const QUERY_PRESET_CATEGORIES: Array<{
  key: PresetCategory;
  label: string;
  description: string;
}> = [
  {
    key: "configuration",
    label: "Exposed Configuration Files",
    description:
      "Hunt for publicly indexed configuration artifacts, environment files, and structured data.",
  },
  {
    key: "directories",
    label: "Open Directory Listings",
    description:
      "Identify browsable indexes, mirrored assets, and loosely protected file listings.",
  },
  {
    key: "documents",
    label: "Public Document Repositories",
    description:
      "Surface document portals, file libraries, and indexed report collections.",
  },
  {
    key: "social",
    label: "Social Profile Enumeration",
    description:
      "Pivot across common social and developer platforms using names and usernames.",
  },
  {
    key: "targeting",
    label: "Targeted Recon",
    description:
      "Run focused public research queries against domains, usernames, or email identifiers.",
  },
];

export const QUERY_PRESETS: QueryPreset[] = [
  {
    id: "exposed-env-files",
    name: "Exposed Environment Files",
    description:
      "Search for indexed environment files and adjacent sensitive configuration references.",
    category: "configuration",
    operators: {
      filetype: "env",
      intext: "DB_PASSWORD OR API_KEY OR SECRET_KEY",
    },
    freeText: "\".env\" OR \"environment\"",
    tags: ["config", "secrets", "env"],
  },
  {
    id: "public-json-configs",
    name: "Public JSON Configs",
    description:
      "Look for structured JSON configuration files and deployment artifacts.",
    category: "configuration",
    operators: {
      filetype: "json",
      intext: "\"client_secret\" OR \"token\" OR \"apiKey\"",
    },
    freeText: "\"config\" OR \"settings\"",
    tags: ["json", "configuration", "api"],
  },
  {
    id: "yaml-devops-files",
    name: "YAML DevOps Files",
    description:
      "Discover YAML manifests that may reveal infrastructure or deployment metadata.",
    category: "configuration",
    operators: {
      filetype: "yaml",
      intext: "pipeline OR kubernetes OR docker OR secret",
    },
    freeText: "\"config\" OR \"deployment\"",
    tags: ["yaml", "devops", "infra"],
  },
  {
    id: "sql-dumps",
    name: "Indexed SQL Dumps",
    description:
      "Search for database exports, schema backups, and SQL dump disclosures.",
    category: "configuration",
    operators: {
      filetype: "sql",
      inurl: "backup OR dump",
      intext: "\"INSERT INTO\" OR \"CREATE TABLE\"",
    },
    tags: ["sql", "database", "backup"],
  },
  {
    id: "open-directory-listings",
    name: "Open Directory Listings",
    description:
      "Identify public web directory indexes and file listing pages.",
    category: "directories",
    operators: {
      intitle: "\"index of\"",
      inurl: "uploads OR backup OR parent directory",
    },
    tags: ["directory", "listing", "files"],
  },
  {
    id: "apache-nginx-listings",
    name: "Apache / Nginx Listings",
    description:
      "Find common web server index pages exposed through default directory views.",
    category: "directories",
    operators: {
      intitle: "\"index of\"",
      intext: "\"Parent Directory\" OR \"Last modified\"",
    },
    tags: ["apache", "nginx", "listing"],
  },
  {
    id: "public-document-portals",
    name: "Public Document Portals",
    description:
      "Locate repositories of public reports, policies, manuals, and downloadable documents.",
    category: "documents",
    operators: {
      inurl: "documents OR downloads OR repository",
      filetype: "pdf",
    },
    freeText: "\"report\" OR \"policy\" OR \"manual\"",
    tags: ["documents", "pdf", "portal"],
  },
  {
    id: "spreadsheet-repositories",
    name: "Spreadsheet Repositories",
    description:
      "Search for indexed spreadsheet collections and tabular public data.",
    category: "documents",
    operators: {
      filetype: "xlsx",
      inurl: "data OR reports OR exports",
    },
    freeText: "\"budget\" OR \"inventory\" OR \"report\"",
    tags: ["xlsx", "spreadsheet", "data"],
  },
  {
    id: "presentation-discovery",
    name: "Presentation Discovery",
    description:
      "Discover publicly indexed slide decks, investor materials, and internal presentations.",
    category: "documents",
    operators: {
      filetype: "pptx",
      intext: "\"confidential\" OR \"internal\" OR \"roadmap\"",
    },
    tags: ["pptx", "presentation", "slides"],
  },
  {
    id: "linkedin-profile-enum",
    name: "LinkedIn Profile Enumeration",
    description:
      "Find LinkedIn profiles associated with a person, handle, or organization.",
    category: "social",
    operators: {
      site: "linkedin.com",
      inurl: "in OR company",
    },
    tags: ["linkedin", "social", "profiles"],
  },
  {
    id: "github-user-enum",
    name: "GitHub Account Enumeration",
    description:
      "Search for developer profiles, repositories, and commits tied to a username.",
    category: "social",
    operators: {
      site: "github.com",
      inurl: "users OR orgs",
    },
    freeText: "\"@gmail.com\" OR \"README\"",
    tags: ["github", "developer", "repos"],
  },
  {
    id: "username-cross-platform",
    name: "Username Cross-Platform Sweep",
    description:
      "Use a generic handle to pivot across major public profile surfaces.",
    category: "social",
    operators: {},
    freeText:
      "\"{username}\" site:github.com OR site:x.com OR site:instagram.com OR site:reddit.com OR site:linkedin.com",
    tags: ["username", "cross-platform", "enumeration"],
  },
  {
    id: "email-document-pivot",
    name: "Email in Public Documents",
    description:
      "Search for email addresses that appear inside public file formats.",
    category: "targeting",
    operators: {
      filetype: "pdf",
      intext: "\"{email}\"",
    },
    freeText: "\"contact\" OR \"directory\"",
    tags: ["email", "pdf", "target"],
  },
  {
    id: "domain-document-sweep",
    name: "Domain Document Sweep",
    description:
      "Search for documents associated with a target domain and common repositories.",
    category: "targeting",
    operators: {
      site: "{domain}",
      inurl: "docs OR files OR downloads",
    },
    freeText: "\"report\" OR \"policy\" OR \"handbook\"",
    tags: ["domain", "documents", "sweep"],
  },
];

export const FILE_FORMATS: FileFormatDefinition[] = [
  {
    extension: "pdf",
    label: "PDF",
    group: "document",
    colorClass: "text-emerald-300",
    badgeClass:
      "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    description: "Portable documents, reports, policies, and manuals.",
  },
  {
    extension: "docx",
    label: "DOCX",
    group: "document",
    colorClass: "text-sky-300",
    badgeClass: "border border-sky-500/40 bg-sky-500/10 text-sky-300",
    description: "Word processing files and editable document drafts.",
  },
  {
    extension: "xlsx",
    label: "XLSX",
    group: "document",
    colorClass: "text-lime-300",
    badgeClass: "border border-lime-500/40 bg-lime-500/10 text-lime-300",
    description: "Spreadsheet files, exports, inventories, and tabular data.",
  },
  {
    extension: "pptx",
    label: "PPTX",
    group: "document",
    colorClass: "text-orange-300",
    badgeClass:
      "border border-orange-500/40 bg-orange-500/10 text-orange-300",
    description: "Presentation decks, slides, and briefings.",
  },
  {
    extension: "txt",
    label: "TXT",
    group: "document",
    colorClass: "text-zinc-300",
    badgeClass: "border border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
    description: "Plain text notes, exports, and log-like text artifacts.",
  },
  {
    extension: "csv",
    label: "CSV",
    group: "document",
    colorClass: "text-cyan-300",
    badgeClass: "border border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    description: "Comma-separated datasets and structured flat-file exports.",
  },
  {
    extension: "json",
    label: "JSON",
    group: "config",
    colorClass: "text-amber-300",
    badgeClass: "border border-amber-500/40 bg-amber-500/10 text-amber-300",
    description: "Structured configuration, API responses, and app metadata.",
  },
  {
    extension: "yaml",
    label: "YAML",
    group: "config",
    colorClass: "text-fuchsia-300",
    badgeClass:
      "border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
    description: "Infrastructure manifests and human-readable config files.",
  },
  {
    extension: "xml",
    label: "XML",
    group: "config",
    colorClass: "text-violet-300",
    badgeClass: "border border-violet-500/40 bg-violet-500/10 text-violet-300",
    description: "Feeds, exports, configs, and verbose structured documents.",
  },
  {
    extension: "sql",
    label: "SQL",
    group: "config",
    colorClass: "text-rose-300",
    badgeClass: "border border-rose-500/40 bg-rose-500/10 text-rose-300",
    description: "Schema dumps, query files, and database exports.",
  },
  {
    extension: "log",
    label: "LOG",
    group: "config",
    colorClass: "text-red-300",
    badgeClass: "border border-red-500/40 bg-red-500/10 text-red-300",
    description: "Application, access, and diagnostic log files.",
  },
  {
    extension: "env",
    label: "ENV",
    group: "config",
    colorClass: "text-yellow-300",
    badgeClass:
      "border border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
    description: "Environment variable files and deployment secrets metadata.",
  },
  {
    extension: "zip",
    label: "ZIP",
    group: "archive",
    colorClass: "text-pink-300",
    badgeClass: "border border-pink-500/40 bg-pink-500/10 text-pink-300",
    description: "Compressed archives and bundled data packages.",
  },
  {
    extension: "tar",
    label: "TAR",
    group: "archive",
    colorClass: "text-indigo-300",
    badgeClass: "border border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
    description: "Unix archive bundles and backup packaging artifacts.",
  },
];

export const FILE_FORMAT_GROUPS: Array<{
  key: FileFormatGroup;
  label: string;
  description: string;
}> = [
  {
    key: "document",
    label: "Documents",
    description: "Office files, reports, text artifacts, and general records.",
  },
  {
    key: "config",
    label: "Config / Data",
    description:
      "Configuration files, machine-readable data, logs, and exported state.",
  },
  {
    key: "archive",
    label: "Archives",
    description: "Compressed packages and backup-oriented file bundles.",
  },
];

export const DEFAULT_BATCH_EXTENSIONS = FILE_FORMATS.map(
  (format) => format.extension,
);

export const FILE_FORMAT_LOOKUP = Object.fromEntries(
  FILE_FORMATS.map((format) => [format.extension, format]),
) as Record<string, FileFormatDefinition>;
