import { DurableObjectStorage } from '../deps.ts';
import { AdminDataRequest, AdminDataResponse, ExternalNotificationRequest, Unkinded } from '../rpc_model.ts';
import { ShowControllerNotifications } from './show_controller_notifications.ts';

export class ShowController {

    private readonly storage: DurableObjectStorage;
    private readonly notifications: ShowControllerNotifications

    constructor(storage: DurableObjectStorage) {
        this.storage = storage;
        this.notifications = new ShowControllerNotifications(storage);
    }

    async receiveExternalNotification({ notification, received } : Unkinded<ExternalNotificationRequest>): Promise<void> {
        await this.notifications.receiveExternalNotification({ notification, received });
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        const res = await this.notifications.adminExecuteDataQuery(req);
        if (res) return res;

        throw new Error(`Unsupported show-related query`);
    }   

}
