const eejs = require('ep_etherpad-lite/node/eejs/');

exports.expressConfigure = async (hookName, { app }) => {
  app.get('/admin/plugin/userpadadmin', (req, res) => {
    // Check if user is admin (basic auth check)
    if (!req.session || !req.session.user || !req.session.user.is_admin) {
      return res.status(403).send('Access denied');
    }

    var render_args = {
      errors: [],
    };
    res.send(eejs.require('ep_maadix/templates/admin/user_pad_admin.html', render_args));
  });
};

exports.eejsBlock_adminMenu = async (hookName, args) => {
  // Add menu items to the admin sidebar
  console.log('················');
  args.content =
    args.content +
    `
    <div class="menu-option">
      <a href="/admin/custom-page">
        <i class="fa fa-cog"></i>
        Custom Settings
      </a>
    </div>
    <div class="menu-option">
      <a href="/admin/analytics">
        <i class="fa fa-chart-bar"></i>
        Analytics
      </a>
    </div>
  `;
};
