import { invoke } from '@tauri-apps/api/core';

export interface User {
    id: number;
    username: string;
    cargo?: string;
    email?: string;
    store_id?: number;
    is_active: boolean;
    created_at?: string;
}

export const userService = {
    async getAllUsers(): Promise<User[]> {
        return await invoke('get_all_users');
    },

    async createUser(
        username: string,
        password: string,
        cargo: string | null,
        email: string | null,
        store_id: number | null,
        role_name: string
    ): Promise<User> {
        return await invoke('create_staff_user', {
            username,
            password,
            cargo,
            email,
            storeId: store_id,
            roleName: role_name
        });
    },

    async updateUser(
        id: number,
        cargo: string | null,
        email: string | null,
        store_id: number | null
    ): Promise<void> {
        return await invoke('update_user', {
            id,
            cargo,
            email,
            storeId: store_id
        });
    },

    async deleteUser(id: number): Promise<void> {
        return await invoke('delete_user', { id });
    },

    async getUsersByStore(store_id: number): Promise<User[]> {
        return await invoke('get_users_by_store', { storeId: store_id });
    }
};
