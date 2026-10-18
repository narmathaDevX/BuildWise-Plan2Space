# BuildWise Platform

An integrated construction-planning repository containing two separate applications.

## 1. BuildWise

BuildWise helps users plan residential construction using plot dimensions, room requirements, cost estimates, materials information, and construction scheduling.

Technologies: Python, FastAPI, React, Vite, SQLite, and algorithmic floor-plan generation.

Project directory: `buildwise/`
Documentation: `buildwise/README.md`

## 2. Plan2Space 3D

Plan2Space 3D is a separate project for processing 2D floor-plan geometry and visualizing it in a 3D web studio.

Technologies: Python, FastAPI, JavaScript, HTML, CSS, and WebGL-based visualization.

Project directory: `plan2space-3d/`
Documentation: `plan2space-3d/README.md`

## Repository Structure

```text
buildwise-platform/
├── buildwise/
│   ├── backend/
│   ├── frontend/
│   ├── docs/
│   └── README.md
├── plan2space-3d/
│   ├── app/
│   ├── frontend/
│   ├── tests/
│   └── README.md
├── .gitignore
└── README.md
```

## Getting Started

Each project has its own dependencies and setup instructions. Read its README and requirements files before starting the application.

- BuildWise backend: `buildwise/backend/`
- BuildWise frontend: `buildwise/frontend/`
- Plan2Space 3D backend: `plan2space-3d/`
- Plan2Space 3D frontend: `plan2space-3d/frontend/`

## Integration Status

Both applications are stored in one Git repository but remain separate applications. API integration between them has not yet been configured as part of this repository setup.

## Security

Do not commit API keys, passwords, access tokens, environment secrets, or local database files.

## License

No license has been specified yet.
