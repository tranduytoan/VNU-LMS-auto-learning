import axios from "axios";
import FormData from "form-data";
import "dotenv/config";
import fs from "fs";

let accessToken = process.env.ACCESS_TOKEN;
let refreshToken = process.env.REFRESH_TOKEN;

const apiClient = axios.create({
    baseURL: 'https://lms.vnu.edu.vn/dhqg.lms.api/api/v1',
    headers: {
        'Authorization': `Bearer ${accessToken}`
    }
});

// interceptors for 401 errors
apiClient.interceptors.response.use(
    response => response,
    async error => {
        if (error.response && error.response.status === 401) {
            try {
                const form = new FormData();
                form.append("grant_type", "refresh_token");
                form.append("client_id", "web");
                form.append("refresh_token", refreshToken);

                const res = await axios.post('https://lms.vnu.edu.vn/dhqg.authentication.api/connect/token', form, {
                    headers: {
                        ...form.getHeaders(),
                    }
                });
                accessToken = res.data.access_token;
                refreshToken = res.data.refresh_token;
                updateEnv({ ACCESS_TOKEN: accessToken, REFRESH_TOKEN: refreshToken });
                apiClient.defaults.headers['Authorization'] = `Bearer ${accessToken}`;
                error.config.headers['Authorization'] = `Bearer ${accessToken}`;
                
                return apiClient.request(error.config);
            } catch (refreshError) {
                console.error('Failed to refresh token:', refreshError);
                return Promise.reject(refreshError);
            }
        } else {
            return Promise.reject(error);
        }
    }
);

function updateEnv(updates) {
  const envPath = ".env";
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(env)) {
      // Nếu đã có key -> thay thế
      env = env.replace(regex, `${key}=${value}`);
    } else {
      // Nếu chưa có key -> thêm mới
      if (env.length > 0 && !env.endsWith("\n")) env += "\n";
      env += `${key}=${value}\n`;
    }
  }

  fs.writeFileSync(envPath, env);
}

export const LmsApi = {
    getListCurrentClasses: async () => {
        const response = await apiClient.get('/LmsHistory/FeClassCurrent?order=1');
        return response.data;
    },

    getClassDetails: async (classId) => {
        const response = await apiClient.get(`/LmsClass/FrGetById/${classId}`);
        return response.data;
    },

    // general info
    getClassContentsGeneral: async (classId) => {
        const response = await apiClient.get(`/LmsClassContent/frGetByClassId/${classId}`);
        return response.data;
    },

    // with user-status info
    getClassContentsUser: async (classId) => {
        const response = await apiClient.get(`/LmsClass/FrUserJoinClassNew/${classId}`);
        return response.data;
    },

    getContentUserCanView: async (classUserId, classContentId) => {
        const response = await apiClient.get(`/LmsClassContent/frUserCanViewNew/${classUserId}/${classContentId}`);
        return response.data;
    }
};
