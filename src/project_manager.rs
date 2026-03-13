use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::SystemTime;

const CONFIG_FILE: &str = "prj_config.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub id: String,
    pub name: String,
    pub curr_prj: Option<String>,
    pub projects: Vec<Project>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Favorite {
    pub env_id: String,
    pub project_id: String,
    pub path: String,
    pub name: String,
    pub added_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub curr_env: String,
    pub environments: Vec<Environment>,
    #[serde(default)]
    pub favorites: Vec<Favorite>,
}

impl Default for ProjectConfig {
    fn default() -> Self {
        Self {
            curr_env: "default".to_string(),
            environments: vec![Environment {
                id: "default".to_string(),
                name: "기본 환경".to_string(),
                curr_prj: None,
                projects: vec![],
            }],
            favorites: vec![],
        }
    }
}

pub struct ProjectManager {
    config: Arc<RwLock<ProjectConfig>>,
    config_path: PathBuf,
}

impl ProjectManager {
    pub fn new() -> Result<Self> {
        let config_path = PathBuf::from(CONFIG_FILE);
        let config = Self::load_config(&config_path)?;

        Ok(Self {
            config: Arc::new(RwLock::new(config)),
            config_path,
        })
    }

    fn load_config(path: &Path) -> Result<ProjectConfig> {
        if path.exists() {
            let content = fs::read_to_string(path)
                .context("Failed to read config file")?;
            let config: ProjectConfig = serde_json::from_str(&content)
                .context("Failed to parse config file")?;
            Ok(config)
        } else {
            log::info!("Config file not found, creating default config");
            let config = ProjectConfig::default();
            Self::save_config_to_file(path, &config)?;
            Ok(config)
        }
    }

    fn save_config_to_file(path: &Path, config: &ProjectConfig) -> Result<()> {
        let content = serde_json::to_string_pretty(config)
            .context("Failed to serialize config")?;
        fs::write(path, content)
            .context("Failed to write config file")?;
        Ok(())
    }

    fn save_config(&self) -> Result<()> {
        let config = self.config.read().unwrap();
        Self::save_config_to_file(&self.config_path, &config)
    }

    pub fn get_config(&self) -> ProjectConfig {
        self.config.read().unwrap().clone()
    }

    pub fn get_current_watch_dir(&self) -> Option<PathBuf> {
        let config = self.config.read().unwrap();
        let env = config.environments.iter()
            .find(|e| e.id == config.curr_env)?;

        let prj_id = env.curr_prj.as_ref()?;
        let project = env.projects.iter()
            .find(|p| &p.id == prj_id)?;

        Some(PathBuf::from(&project.path))
    }

    // Environment operations
    pub fn add_environment(&self, id: String, name: String) -> Result<()> {
        let mut config = self.config.write().unwrap();

        if config.environments.iter().any(|e| e.id == id) {
            anyhow::bail!("Environment with id '{}' already exists", id);
        }

        config.environments.push(Environment {
            id,
            name,
            curr_prj: None,
            projects: vec![],
        });

        drop(config);
        self.save_config()
    }

    pub fn update_environment(&self, id: String, new_name: String) -> Result<()> {
        let mut config = self.config.write().unwrap();

        let env = config.environments.iter_mut()
            .find(|e| e.id == id)
            .context("Environment not found")?;

        env.name = new_name;

        drop(config);
        self.save_config()
    }

    pub fn delete_environment(&self, id: String) -> Result<()> {
        let mut config = self.config.write().unwrap();

        if config.environments.len() <= 1 {
            anyhow::bail!("Cannot delete the last environment");
        }

        config.environments.retain(|e| e.id != id);
        config.favorites.retain(|f| f.env_id != id);

        drop(config);
        self.save_config()
    }


    // Project operations
    pub fn add_project(&self, env_id: String, id: String, name: String, path: String) -> Result<()> {
        let mut config = self.config.write().unwrap();

        let env = config.environments.iter_mut()
            .find(|e| e.id == env_id)
            .context("Environment not found")?;

        if env.projects.iter().any(|p| p.id == id) {
            anyhow::bail!("Project with id '{}' already exists in this environment", id);
        }

        env.projects.push(Project { id, name, path });

        drop(config);
        self.save_config()
    }

    pub fn update_project(&self, env_id: String, id: String, name: String, path: String) -> Result<()> {
        let mut config = self.config.write().unwrap();

        let env = config.environments.iter_mut()
            .find(|e| e.id == env_id)
            .context("Environment not found")?;

        let project = env.projects.iter_mut()
            .find(|p| p.id == id)
            .context("Project not found")?;

        project.name = name;
        project.path = path;

        drop(config);
        self.save_config()
    }

    pub fn delete_project(&self, env_id: String, project_id: String) -> Result<()> {
        let mut config = self.config.write().unwrap();

        let env = config.environments.iter_mut()
            .find(|e| e.id == env_id)
            .context("Environment not found")?;

        env.projects.retain(|p| p.id != project_id);
        config.favorites.retain(|f| !(f.env_id == env_id && f.project_id == project_id));

        drop(config);
        self.save_config()
    }

    // Favorite operations
    pub fn get_favorites(&self) -> Vec<Favorite> {
        self.config.read().unwrap().favorites.clone()
    }

    pub fn add_favorite(&self, env_id: String, project_id: String, path: String) -> Result<()> {
        let mut config = self.config.write().unwrap();

        // Duplicate check
        let already_exists = config.favorites.iter().any(|f|
            f.env_id == env_id && f.project_id == project_id && f.path == path
        );
        if already_exists {
            anyhow::bail!("Already in favorites");
        }

        // Validate environment and project exist
        let env = config.environments.iter()
            .find(|e| e.id == env_id)
            .context("Environment not found")?;
        let _project = env.projects.iter()
            .find(|p| p.id == project_id)
            .context("Project not found")?;

        let name = path.split('/').last().unwrap_or(&path).to_string();
        let added_at = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        config.favorites.push(Favorite {
            env_id, project_id, path, name, added_at
        });

        drop(config);
        self.save_config()
    }

    pub fn remove_favorite(&self, env_id: &str, project_id: &str, path: &str) -> Result<()> {
        let mut config = self.config.write().unwrap();
        let before_len = config.favorites.len();
        config.favorites.retain(|f|
            !(f.env_id == env_id && f.project_id == project_id && f.path == path)
        );
        if config.favorites.len() == before_len {
            anyhow::bail!("Favorite not found");
        }
        drop(config);
        self.save_config()
    }
}
